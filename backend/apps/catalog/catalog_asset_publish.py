"""Публикация FileAsset на витрину: model_glb/rfa/ifc + счётчики до/после."""
from __future__ import annotations

import os
from typing import Iterable

from django.db import models
from django.db.models import QuerySet

from apps.catalog.asset_resolution import find_file_assets_for_product
from apps.catalog.file_urls import (
    should_replace_product_model_url_with_asset,
)
from apps.catalog.models import Product
from apps.catalog.product_model_files import url_has_extension
from apps.catalog.views import catalog_has_2d_photo_q, catalog_has_glb_q


def apply_model_urls_from_assets(product: Product) -> list[str]:
    """
    Записать в model_glb/rfa/ifc стабильные URL из FileAsset (S3).
    Возвращает список изменённых полей (glb, rfa, ifc, …).
    """
    assets = list(find_file_assets_for_product(product))
    if not assets:
        return []

    changes: list[str] = []
    new_glb = product.model_glb
    new_rfa = product.model_rfa
    new_ifc = product.model_ifc

    for asset in assets:
        if not asset.file or not hasattr(asset.file, "url"):
            continue
        ext = os.path.splitext(asset.file.name)[1].lower()
        url = (asset.file.url or "").strip()
        if not url:
            continue
        if ext == ".glb" and should_replace_product_model_url_with_asset(product.model_glb, url):
            new_glb = url
            changes.append("glb")
        elif ext == ".rfa" and not (product.model_rfa or "").strip():
            new_rfa = url
            changes.append("rfa")
        elif ext == ".ifc" and not (product.model_ifc or "").strip():
            new_ifc = url
            changes.append("ifc")
        elif ext == ".ifc" and url_has_extension(product.model_rfa, ".ifc") and not (
            product.model_ifc or ""
        ).strip():
            new_ifc = url
            new_rfa = ""
            changes.append("ifc←rfa")

    if not changes:
        return []

    Product.objects.filter(pk=product.pk).update(
        model_glb=new_glb,
        model_rfa=new_rfa,
        model_ifc=new_ifc,
    )
    product.model_glb = new_glb
    product.model_rfa = new_rfa
    product.model_ifc = new_ifc
    return changes


def backfill_queryset(qs: QuerySet[Product], *, dry_run: bool = False) -> tuple[int, int]:
    """Просмотреть queryset и обновить model_* из FileAsset. Returns (updated, seen)."""
    updated = 0
    seen = 0
    for product in qs.iterator(chunk_size=200):
        seen += 1
        changes = apply_model_urls_from_assets(product) if not dry_run else _dry_run_changes(product)
        if changes:
            updated += 1
    return updated, seen


def _dry_run_changes(product: Product) -> list[str]:
    assets = list(find_file_assets_for_product(product))
    if not assets:
        return []
    changes: list[str] = []
    for asset in assets:
        if not asset.file or not hasattr(asset.file, "url"):
            continue
        ext = os.path.splitext(asset.file.name)[1].lower()
        url = (asset.file.url or "").strip()
        if ext == ".glb" and should_replace_product_model_url_with_asset(product.model_glb, url):
            changes.append("glb")
        elif ext == ".rfa" and not (product.model_rfa or "").strip():
            changes.append("rfa")
        elif ext == ".ifc" and not (product.model_ifc or "").strip():
            changes.append("ifc")
    return changes


def catalog_visibility_counts(qs: QuerySet[Product]) -> dict[str, int]:
    active = qs.filter(is_active=True)
    return {
        "total": qs.count(),
        "active": active.count(),
        "visible_3d": active.filter(catalog_has_glb_q()).count(),
        "visible_2d": active.filter(catalog_has_2d_photo_q()).count(),
    }


def format_counts(label: str, counts: dict[str, int]) -> str:
    return (
        f"{label}: total={counts['total']} active={counts['active']} "
        f"3D={counts['visible_3d']} 2D={counts['visible_2d']}"
    )


def product_ids_for_assets(asset_ids: Iterable[str]) -> set[int]:
    """Товары, которых коснулась привязка файлов (для точечного backfill после SFTP)."""
    from apps.catalog.asset_matching import find_product_for_file_asset_id

    pks: set[int] = set()
    for aid in asset_ids:
        p = find_product_for_file_asset_id(aid)
        if p:
            pks.add(p.pk)
    return pks


def link_orphan_glb_assets(
    *,
    category_id: int | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Обратная привязка: GLB в FileAsset → товар (как у пуфов после SFTP).
    Нужна, когда файлы залили, а article IMR-* ≠ имени файла Стол4617.glb.
    """
    from apps.catalog.asset_matching import find_product_for_file_asset_id
    from apps.catalog.models import FileAsset

    glb_assets = (
        FileAsset.objects.filter(file_type="3d_model")
        .exclude(file="")
        .filter(
            models.Q(file__iendswith=".glb")
            | models.Q(file__iendswith=".gltf")
            | models.Q(file__iendswith=".usdz")
        )
    )

    scanned = 0
    matched = 0
    linked = 0
    orphans = 0

    for asset in glb_assets.iterator(chunk_size=300):
        scanned += 1
        product = find_product_for_file_asset_id(asset.asset_id or "")
        if not product:
            orphans += 1
            continue
        if category_id is not None and product.category_id != category_id:
            continue
        matched += 1
        if dry_run:
            linked += 1
            continue
        changes = apply_model_urls_from_assets(product)
        if changes:
            linked += 1

    return {
        "scanned": scanned,
        "matched_in_category": matched,
        "linked": linked,
        "orphans_no_product": orphans,
    }


def diagnose_category_vs_pouf(category_id: int, sample: int = 3) -> list[str]:
    """Сравнение полей с рабочим пуфом — для --verbose."""
    from apps.catalog.asset_resolution import product_model_glb_diagnosis

    pouf = (
        Product.objects.filter(category__name__icontains="пуф", is_active=True)
        .exclude(model_glb="")
        .first()
    )
    desk_qs = Product.objects.filter(category_id=category_id, is_active=True).order_by("id")

    lines = []
    if pouf:
        d = product_model_glb_diagnosis(pouf)
        lines.append(
            f"Эталон (пуф id={d['id']}): article={d['article']!r} "
            f"model_glb_url={d['model_glb_is_url']} keys={d['lookup_keys']}"
        )
    for p in desk_qs[:sample]:
        d = product_model_glb_diagnosis(p)
        lines.append(
            f"  id={d['id']} article={d['article']!r} title={d['title']!r} "
            f"model_glb={d['model_glb_preview']!r} url={d['model_glb_is_url']} "
            f"FileAsset={d['fileasset_glb']}"
        )
    return lines