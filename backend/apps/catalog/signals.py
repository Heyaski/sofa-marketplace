from __future__ import annotations

import re
from typing import Optional

from django.conf import settings
from django.db.models import Q
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from apps.catalog.models import FileAsset, Product
from apps.catalog.tasks import convert_rfa_to_glb_task


def _is_revit_rfa_url(url: str | None) -> bool:
    if not url or not str(url).strip():
        return False
    return str(url).strip().lower().split("?")[0].endswith(".rfa")


@receiver(pre_save, sender=Product)
def remember_old_rfa(sender, instance: Product, **kwargs):
    if not instance.pk:
        instance._old_model_rfa = None
        instance._old_model_glb = None
        return
    old = Product.objects.filter(pk=instance.pk).only("model_rfa", "model_glb").first()
    instance._old_model_rfa = old.model_rfa if old else None
    instance._old_model_glb = old.model_glb if old else None


@receiver(post_save, sender=Product)
def queue_rfa_conversion(sender, instance: Product, created: bool, **kwargs):
    if not getattr(settings, "RFA_CONVERT_ENABLED", True):
        return
    if not _is_revit_rfa_url(instance.model_rfa):
        return
    old_rfa = getattr(instance, "_old_model_rfa", None)
    rfa_changed = created or old_rfa != instance.model_rfa
    has_preview = bool((instance.model_rfa_glb_preview or "").strip())
    # Раньше при неизменном RFA задача не ставилась — GLB-превью с S3 так и не появлялся
    # (остались только ссылки zaohaowu в model_glb).
    if not rfa_changed and has_preview:
        return

    Product.objects.filter(pk=instance.pk).update(
        model_rfa_convert_status="queued",
        model_rfa_convert_error="",
    )
    convert_rfa_to_glb_task.delay(instance.pk)


@receiver(post_save, sender=Product)
def queue_glb_2d_catalog_preview(sender, instance: Product, created: bool, **kwargs):
    """
    Если появился/сменился GLB и у товара нет фото для 2D — ставим задачу на рендер превью.
    GLB не трогаем, заполняется только image (см. glb_2d_preview).
    """
    if kwargs.get("raw"):
        return
    if not created:
        old_glb = getattr(instance, "_old_model_glb", None)
        if old_glb == instance.model_glb:
            return

    from apps.catalog.glb_2d_preview import maybe_queue_glb_2d_preview

    maybe_queue_glb_2d_preview(instance)


def _asset_id_search_keys(asset_id: str) -> list[str]:
    """Варианты ID как в Excel/импорте: пробелы, слитное написание кириллицы."""
    raw = (asset_id or "").strip()
    if not raw:
        return []
    keys: set[str] = {raw}
    compact = re.sub(r"\s+", "", raw)
    if compact:
        keys.add(compact)
    for base in list(keys):
        spaced = re.sub(r"([а-яёa-z])([А-ЯЁA-Z])", r"\1 \2", base)
        if spaced != base:
            keys.add(spaced)
    return list(keys)


def _article_keys_matching_asset_id(asset_id: str) -> set[str]:
    """Значения article, при которых _get_assets_by_article_fallback находит этот asset_id."""
    keys: set[str] = set()
    raw = (asset_id or "").strip()
    if not raw:
        return keys
    keys.add(raw)
    for i, ch in enumerate(raw):
        if ch in "_-" and i > 0:
            keys.add(raw[:i])
    return keys


def _q_model_3d_asset_ids_tokens(keys: list[str]) -> Optional[Q]:
    accum: Optional[Q] = None
    for key in keys:
        if not key:
            continue
        part = (
            Q(model_3d_asset_ids__iexact=key)
            | Q(model_3d_asset_ids__istartswith=f"{key},")
            | Q(model_3d_asset_ids__iendswith=f",{key}")
            | Q(model_3d_asset_ids__icontains=f",{key},")
        )
        accum = part if accum is None else (accum | part)
    return accum


def _q_article_fallback(article_keys: set[str]) -> Optional[Q]:
    accum: Optional[Q] = None
    for key in article_keys:
        if not key:
            continue
        part = Q(article__iexact=key)
        accum = part if accum is None else (accum | part)
    return accum


def iter_products_linked_to_3d_file_asset(asset: FileAsset):
    """
    Товары, у которых get_3d_model_assets() включает этот FileAsset.
    Связь в БД только через model_3d_asset_ids / article (см. Product.get_3d_model_assets).
    """
    search_keys = _asset_id_search_keys(asset.asset_id)
    if not search_keys:
        return
    article_keys: set[str] = set()
    for k in search_keys:
        article_keys |= _article_keys_matching_asset_id(k)
    parts: list[Q] = []
    mq = _q_model_3d_asset_ids_tokens(search_keys)
    if mq is not None:
        parts.append(mq)
    aq = _q_article_fallback(article_keys)
    if aq is not None:
        parts.append(aq)
    if not parts:
        return
    combined = parts[0]
    for p in parts[1:]:
        combined |= p
    for product in Product.objects.filter(combined).distinct().iterator():
        if product.get_3d_model_assets().filter(pk=asset.pk).exists():
            yield product


@receiver(post_save, sender=FileAsset)
def queue_glb_2d_on_file_asset(sender, instance: FileAsset, created: bool, **kwargs):
    """
    Автоматически генерировать 2D превью когда к товару добавляется/обновляется GLB FileAsset.
    Срабатывает для 3d_model-ассетов с расширением .glb/.gltf (в т.ч. повторная загрузка).
    """
    if kwargs.get("raw"):
        return
    if not getattr(settings, "GLB_2D_PREVIEW_ENABLED", True):
        return
    if not getattr(settings, "GLB_2D_PREVIEW_AUTO_QUEUE", True):
        return
    if instance.file_type != "3d_model":
        return
    fname = (getattr(instance.file, "name", "") or "").lower()
    if not fname.endswith((".glb", ".gltf")):
        return

    from apps.catalog.glb_2d_preview import maybe_queue_glb_2d_preview

    for product in iter_products_linked_to_3d_file_asset(instance):
        maybe_queue_glb_2d_preview(product)

