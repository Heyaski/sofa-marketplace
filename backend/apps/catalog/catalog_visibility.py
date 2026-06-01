"""Флаги catalog_visible_2d/3d на Product — быстрый list API без тяжёлого catalog_has_glb_q()."""
from __future__ import annotations

from django.db import models

from apps.catalog.file_urls import is_ephemeral_external_model_url, url_looks_like_browser_model_file
from apps.catalog.models import Product


def _usable_http_photo(product: Product) -> bool:
    if product.image and getattr(product.image, "name", None):
        return True
    photo = (product.photo_url or "").strip()
    return photo.startswith(("http://", "https://"))


def product_is_catalog_visible_3d(product: Product) -> bool:
    """Совпадает с витриной 3D: браузерный GLB в полях товара (без FileAsset EXISTS)."""
    for url in (product.model_glb, product.model_rfa_glb_preview, product.model_ar_glb):
        if url_looks_like_browser_model_file(url) and not is_ephemeral_external_model_url(url):
            return True
    return False


def product_is_catalog_visible_2d(product: Product) -> bool:
    if _usable_http_photo(product):
        return True
    name = getattr(product.image, "name", None) if product.image else None
    return bool(name and str(name).strip())


def refresh_product_visibility_flags(product: Product, *, save: bool = True) -> tuple[bool, bool]:
    v3 = product_is_catalog_visible_3d(product)
    v2 = product_is_catalog_visible_2d(product)
    if save and (product.catalog_visible_3d != v3 or product.catalog_visible_2d != v2):
        Product.objects.filter(pk=product.pk).update(
            catalog_visible_3d=v3,
            catalog_visible_2d=v2,
        )
        product.catalog_visible_3d = v3
        product.catalog_visible_2d = v2
    return v3, v2


def refresh_visibility_for_product_ids(product_ids: list[int]) -> int:
    if not product_ids:
        return 0
    updated = 0
    for product in Product.objects.filter(pk__in=product_ids).iterator(chunk_size=200):
        before = (product.catalog_visible_3d, product.catalog_visible_2d)
        refresh_product_visibility_flags(product, save=True)
        after = (product.catalog_visible_3d, product.catalog_visible_2d)
        if before != after:
            updated += 1
    return updated


def q_catalog_visible_3d() -> models.Q:
    return models.Q(catalog_visible_3d=True)


def q_catalog_visible_2d() -> models.Q:
    return models.Q(catalog_visible_2d=True)
