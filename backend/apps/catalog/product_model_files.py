"""Единые правила: есть ли у товара GLB/RFA/IFC (бейджи админки, папки, API)."""
from __future__ import annotations

from django.db.models import Q

from typing import TYPE_CHECKING

from apps.catalog.file_urls import (
    is_ephemeral_external_model_url,
    url_has_usable_model_extension,
    url_looks_like_browser_model_file,
    url_path_extension,
)

if TYPE_CHECKING:
    from apps.catalog.models import Product


def url_has_extension(url: str | None, ext: str) -> bool:
    if not url or not str(url).strip():
        return False
    want = ext.lower() if ext.startswith(".") else f".{ext.lower()}"
    return url_path_extension(url) == want


def product_has_glb(product: Product) -> bool:
    """Бейдж GLB = тот же критерий, что счётчик папки и 3D-каталог на сайте."""
    if getattr(product, "_file_has_glb", None) is not None:
        return bool(product._file_has_glb)
    from apps.catalog.catalog_glb_q import product_matches_catalog_has_glb_q

    return product_matches_catalog_has_glb_q(product)


def product_has_rfa(product: Product) -> bool:
    if getattr(product, "_file_has_rfa", None) is not None:
        return bool(product._file_has_rfa)
    return url_has_usable_model_extension(product.model_rfa, ".rfa")


def product_has_ifc(product: Product) -> bool:
    """IFC в model_ifc; legacy — .ifc ошибочно в model_rfa."""
    if getattr(product, "_file_has_ifc", None) is not None:
        return bool(product._file_has_ifc)
    return url_has_usable_model_extension(product.model_ifc, ".ifc") or (
        url_has_extension(product.model_rfa, ".ifc")
        and not is_ephemeral_external_model_url(product.model_rfa)
    )


def product_has_fbx(product: Product) -> bool:
    """Только реальный .fbx в model_fbx (не протухший CDN из Excel)."""
    if getattr(product, "_file_has_fbx", None) is not None:
        return bool(product._file_has_fbx)
    return url_has_usable_model_extension(product.model_fbx, ".fbx")


def q_product_has_glb() -> Q:
    """Счётчики папок и фильтр «Есть GLB» — та же логика, что бейджи (catalog_has_glb_q)."""
    from apps.catalog.catalog_glb_q import catalog_has_glb_q

    return catalog_has_glb_q()


def q_product_has_rfa() -> Q:
    blocked = Q()
    for frag in ("auth_key=", "zaohaowu", "hitem3dstatic"):
        blocked |= Q(model_rfa__icontains=frag)
    return (
        Q(model_rfa__isnull=False)
        & ~Q(model_rfa="")
        & (Q(model_rfa__iregex=r"\.rfa(\?|$)") | Q(model_rfa__icontains=".rfa?"))
        & ~blocked
    )


def q_product_has_ifc() -> Q:
    in_ifc = (
        Q(model_ifc__isnull=False)
        & ~Q(model_ifc="")
        & (Q(model_ifc__iregex=r"\.ifc(\?|$)") | Q(model_ifc__icontains=".ifc?"))
    )
    legacy_in_rfa = (
        Q(model_rfa__isnull=False)
        & ~Q(model_rfa="")
        & (Q(model_rfa__iregex=r"\.ifc(\?|$)") | Q(model_rfa__icontains=".ifc?"))
    )
    return in_ifc | legacy_in_rfa


def q_product_has_fbx() -> Q:
    blocked = Q()
    for frag in ("auth_key=", "zaohaowu", "hitem3dstatic"):
        blocked |= Q(model_fbx__icontains=frag)
    return (
        Q(model_fbx__isnull=False)
        & ~Q(model_fbx="")
        & (Q(model_fbx__iregex=r"\.fbx(\?|$)") | Q(model_fbx__icontains=".fbx?"))
        & ~blocked
    )


def product_model_files_q_components():
    """Условия для GLB / RFA / IFC (счётчики папок, фильтры, bundle)."""
    return q_product_has_glb(), q_product_has_rfa(), q_product_has_ifc()


def annotate_admin_file_flags(queryset):
    """Аннотации для changelist — бейджи без N+1 и 100% как catalog_has_glb_q."""
    from django.db.models import Exists, OuterRef

    from apps.catalog.catalog_glb_q import catalog_has_glb_q

    glb_q = catalog_has_glb_q()
    rfa_q, ifc_q = q_product_has_rfa(), q_product_has_ifc()
    fbx_q = q_product_has_fbx()
    sub = Product.objects.filter(pk=OuterRef("pk"))
    return queryset.annotate(
        _file_has_glb=Exists(sub.filter(glb_q)),
        _file_has_rfa=Exists(sub.filter(rfa_q)),
        _file_has_ifc=Exists(sub.filter(ifc_q)),
        _file_has_fbx=Exists(sub.filter(fbx_q)),
    )
