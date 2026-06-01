"""Флаги catalog_visible_2d/3d — совпадают с фильтрами API и админки."""
from __future__ import annotations

from django.db import models
from django.db.models import QuerySet

from apps.catalog.catalog_glb_q import catalog_has_glb_q, product_matches_catalog_has_glb_q
from apps.catalog.models import Product


def _usable_http_photo(product: Product) -> bool:
    if product.image and getattr(product.image, "name", None):
        return True
    photo = (product.photo_url or "").strip()
    return photo.startswith(("http://", "https://"))


def product_has_catalog_3d_glb(product: Product) -> bool:
    """GLB для 3D-каталога = catalog_has_glb_q (S3 / стабильный URL, не мусор Excel)."""
    return product_matches_catalog_has_glb_q(product)


def product_is_catalog_visible_3d(product: Product) -> bool:
    return product_has_catalog_3d_glb(product)


def product_is_catalog_visible_2d(product: Product) -> bool:
    if _usable_http_photo(product):
        return True
    name = getattr(product.image, "name", None) if product.image else None
    return bool(name and str(name).strip())


def bulk_refresh_catalog_visibility_flags(queryset: QuerySet[Product] | None = None) -> dict[str, int]:
    """
    Пересчитать catalog_visible_* одним SQL (как на сайте list_mode=3d / 2D).
    Вызывать после импорта SFTP, Excel, backfill.
    """
    from apps.catalog.views import catalog_has_2d_photo_q

    qs = queryset if queryset is not None else Product.objects.all()
    glb_q = catalog_has_glb_q()
    photo_q = catalog_has_2d_photo_q()

    n_3d_on = qs.filter(glb_q).update(catalog_visible_3d=True)
    n_3d_off = qs.exclude(glb_q).update(catalog_visible_3d=False)
    n_2d_on = qs.filter(photo_q).update(catalog_visible_2d=True)
    n_2d_off = qs.exclude(photo_q).update(catalog_visible_2d=False)
    return {
        "visible_3d_set": n_3d_on,
        "visible_3d_cleared": n_3d_off,
        "visible_2d_set": n_2d_on,
        "visible_2d_cleared": n_2d_off,
    }


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
    qs = Product.objects.filter(pk__in=product_ids)
    before = {
        pk: (v3, v2)
        for pk, v3, v2 in qs.values_list("pk", "catalog_visible_3d", "catalog_visible_2d")
    }
    bulk_refresh_catalog_visibility_flags(qs)
    after = {
        pk: (v3, v2)
        for pk, v3, v2 in qs.values_list("pk", "catalog_visible_3d", "catalog_visible_2d")
    }
    return sum(1 for pk in before if before[pk] != after.get(pk))


def q_catalog_visible_3d() -> models.Q:
    return models.Q(catalog_visible_3d=True)


def q_catalog_visible_2d() -> models.Q:
    return models.Q(catalog_visible_2d=True)
