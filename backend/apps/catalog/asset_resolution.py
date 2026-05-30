"""Поиск FileAsset для товара — все ключи (артикул, title, model_glb-код, csv ids)."""
from __future__ import annotations

import os
import re

from django.db.models import Case, IntegerField, Q, When

from apps.catalog.asset_matching import asset_id_search_variants, title_tokens_for_asset_match
from apps.catalog.models import FileAsset, Product

GLB_EXTENSIONS = (".glb", ".gltf", ".usdz")


def extract_base_article(asset_id: str) -> str:
    """IMR-556065(1) -> IMR-556065, IMR-1284569WHT -> IMR-1284569."""
    if not asset_id:
        return ""
    s = asset_id.strip()
    if "(" in s:
        return s.split("(")[0].strip()
    m = re.match(r"^(.+)([A-Z]{2,4})$", s.upper())
    if m and len(m.group(1)) >= 4:
        return m.group(1)
    return s


def _looks_like_url(value: str) -> bool:
    v = (value or "").strip().lower()
    return v.startswith(("http://", "https://", "/"))


def product_asset_lookup_keys(product: Product) -> list[str]:
    """Все строки, по которым ищем FileAsset для товара (порядок = приоритет)."""
    ordered: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        for key in asset_id_search_variants((raw or "").strip()):
            lk = key.lower()
            if lk and lk not in seen:
                seen.add(lk)
                ordered.append(key)

    raw_ids = (product.model_3d_asset_ids or "").strip()
    if raw_ids:
        for part in raw_ids.split(","):
            add(part.strip())

    mg = (product.model_glb or "").strip()
    if mg and not _looks_like_url(mg):
        add(mg)

    art = (product.article or "").strip()
    if art:
        add(art)
        add(extract_base_article(art))

    for tok in title_tokens_for_asset_match(product.title):
        add(tok)

    raw_img = (product.image_asset_ids or "").strip()
    if raw_img:
        for part in raw_img.split(","):
            add(part.strip())

    return ordered


def _is_browser_3d_asset(asset: FileAsset) -> bool:
    name = (getattr(asset.file, "name", "") or "").lower()
    return name.endswith(GLB_EXTENSIONS)


def _file_assets_for_keys(keys: list[str], file_type: str = "3d_model") -> list[FileAsset]:
    if not keys:
        return []

    exact_q = Q()
    prefix_q = Q()
    for key in keys[:60]:
        exact_q |= Q(asset_id__iexact=key)
        prefix_q |= Q(asset_id__istartswith=f"{key}_") | Q(asset_id__istartswith=f"{key}-")

    exact = list(
        FileAsset.objects.filter(file_type=file_type).filter(exact_q).order_by("asset_id")
    )
    prefixed = list(
        FileAsset.objects.filter(file_type=file_type).filter(prefix_q).order_by("asset_id")
    )

    rank_map = {k.lower(): idx for idx, k in enumerate(keys)}

    def _rank(asset: FileAsset) -> tuple[int, str]:
        aid = (asset.asset_id or "").lower()
        best = len(rank_map) + 10
        for k, idx in rank_map.items():
            if aid == k or aid.startswith(f"{k}_") or aid.startswith(f"{k}-"):
                best = min(best, idx)
        return (best, aid)

    combined: list[FileAsset] = []
    seen_pks: set[int] = set()
    for asset in sorted(exact + prefixed, key=_rank):
        if asset.pk in seen_pks:
            continue
        seen_pks.add(asset.pk)
        combined.append(asset)

    return combined


def find_file_assets_for_product(product: Product, file_type: str = "3d_model"):
    """FileAsset для товара — единая логика для backfill и get_3d_model_assets."""
    keys = product_asset_lookup_keys(product)
    assets = _file_assets_for_keys(keys, file_type=file_type)
    if not assets:
        return FileAsset.objects.none()
    order_clauses = [When(pk=a.pk, then=i) for i, a in enumerate(assets)]
    return FileAsset.objects.filter(pk__in=[a.pk for a in assets]).order_by(
        Case(*order_clauses, default=len(assets), output_field=IntegerField())
    )


def find_glb_assets_for_product(product: Product) -> list[FileAsset]:
    return [
        a
        for a in find_file_assets_for_product(product)
        if _is_browser_3d_asset(a)
    ]


def stable_glb_url_from_assets(product: Product) -> str | None:
    from apps.catalog.file_urls import is_ephemeral_external_model_url

    for asset in find_glb_assets_for_product(product):
        if asset.file and hasattr(asset.file, "url"):
            url = (asset.file.url or "").strip()
            if url and not is_ephemeral_external_model_url(url):
                return url
    return None


def product_model_glb_diagnosis(product: Product) -> dict:
    """Краткая диагностика одного товара для publish --verbose."""
    mg = (product.model_glb or "").strip()
    keys = product_asset_lookup_keys(product)
    glb_assets = find_glb_assets_for_product(product)
    return {
        "id": product.pk,
        "article": product.article,
        "title": (product.title or "")[:60],
        "model_glb_preview": mg[:80] if mg else "",
        "model_glb_is_url": _looks_like_url(mg),
        "lookup_keys": keys[:8],
        "fileasset_glb": [a.asset_id for a in glb_assets[:3]],
    }
