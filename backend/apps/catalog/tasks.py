from celery import shared_task
from django.core.cache import cache

from apps.catalog.models import Product
from apps.catalog.rfa_converter import convert_glb_to_rfa_for_product, convert_rfa_to_glb_for_product


def _is_revit_rfa_url(url: str | None) -> bool:
    if not url or not str(url).strip():
        return False
    return str(url).strip().lower().split("?")[0].endswith(".rfa")


def _invalidate_product_cache(product_id: int) -> None:
    cache.delete(f"product_detail:{product_id}")
    try:
        cache.delete_pattern("products_list*")
    except AttributeError:
        pass


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=3)
def convert_rfa_to_glb_task(self, product_id: int):
    product = Product.objects.filter(pk=product_id).first()
    if not product or not product.model_rfa:
        return {"status": "skipped", "reason": "no-product-or-rfa"}
    mr = (product.model_rfa or "").strip()
    if not mr.lower().split("?")[0].endswith(".rfa"):
        return {"status": "skipped", "reason": "not-revit-rfa"}

    Product.objects.filter(pk=product_id).update(
        model_rfa_convert_status="processing",
        model_rfa_convert_error="",
    )

    try:
        preview_url = convert_rfa_to_glb_for_product(product_id)
    except Exception as e:
        Product.objects.filter(pk=product_id).update(
            model_rfa_convert_status="failed",
            model_rfa_convert_error=str(e)[:2000],
        )
        _invalidate_product_cache(product_id)
        raise

    Product.objects.filter(pk=product_id).update(
        model_rfa_glb_preview=preview_url,
        model_rfa_convert_status="ready",
        model_rfa_convert_error="",
    )
    _invalidate_product_cache(product_id)
    product = Product.objects.filter(pk=product_id).first()
    if product:
        from apps.catalog.catalog_visibility import refresh_product_visibility_flags
        from apps.catalog.glb_2d_preview import maybe_queue_glb_2d_preview

        refresh_product_visibility_flags(product, save=True)
        maybe_queue_glb_2d_preview(product)
    return {"status": "ready", "preview": preview_url}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=3)
def convert_glb_to_rfa_task(self, product_id: int):
    product = Product.objects.filter(pk=product_id).first()
    if not product or not product.model_glb:
        return {"status": "skipped", "reason": "no-product-or-glb"}
    if _is_revit_rfa_url(product.model_rfa):
        return {"status": "skipped", "reason": "manual-rfa-present"}

    try:
        rfa_url = convert_glb_to_rfa_for_product(product_id)
    except Exception as e:
        Product.objects.filter(pk=product_id).update(
            model_rfa_convert_status="failed",
            model_rfa_convert_error=str(e)[:2000],
        )
        _invalidate_product_cache(product_id)
        raise

    Product.objects.filter(pk=product_id).update(
        model_rfa=rfa_url,
        model_rfa_convert_status="ready",
        model_rfa_convert_error="",
    )
    _invalidate_product_cache(product_id)
    return {"status": "ready", "rfa": rfa_url}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=2)
def convert_glb_to_usdz_task(self, product_id: int):
    """GLB → USDZ для AR Quick Look на iPhone (из GLB на сайте)."""
    from apps.catalog.glb_to_usdz_converter import (
        _resolve_usdz_ref,
        _usdz_storage_key,
        convert_glb_to_usdz_for_product,
        resolve_product_glb_ref,
    )
    from django.core.files.storage import default_storage

    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return {"status": "skipped", "reason": "no-product"}
    if _resolve_usdz_ref(product) or default_storage.exists(_usdz_storage_key(product_id)):
        return {"status": "skipped", "reason": "already-has-usdz"}
    try:
        resolve_product_glb_ref(product)
    except ValueError:
        return {"status": "skipped", "reason": "no-glb"}

    url = convert_glb_to_usdz_for_product(product_id)
    _invalidate_product_cache(product_id)
    return {"status": "ready", "usdz": url}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=2)
def generate_glb_2d_preview_task(self, product_id: int):
    """PNG-превью из GLB для режима 2D каталога (поле image, GLB не удаляется)."""
    from apps.catalog.glb_2d_preview import run_glb_2d_preview_for_product_id

    return run_glb_2d_preview_for_product_id(product_id)

