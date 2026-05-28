"""Единые правила: есть ли у товара GLB/RFA/IFC (бейджи админки, папки, API)."""
from __future__ import annotations

from django.db.models import Q

from typing import TYPE_CHECKING

from apps.catalog.file_urls import url_looks_like_browser_model_file

if TYPE_CHECKING:
    from apps.catalog.models import Product


def url_has_extension(url: str | None, ext: str) -> bool:
    if not url or not str(url).strip():
        return False
    base = str(url).strip().lower().split("?")[0].rstrip("/")
    return base.endswith(ext.lower())


def product_has_glb(product: Product) -> bool:
    return (
        url_looks_like_browser_model_file(product.model_glb)
        or url_looks_like_browser_model_file(product.model_rfa_glb_preview)
        or url_looks_like_browser_model_file(product.model_ar_glb)
    )


def product_has_rfa(product: Product) -> bool:
    return url_has_extension(product.model_rfa, ".rfa")


def product_has_ifc(product: Product) -> bool:
    """IFC в model_ifc; legacy — .ifc ошибочно в model_rfa."""
    return url_has_extension(product.model_ifc, ".ifc") or url_has_extension(product.model_rfa, ".ifc")


def product_has_fbx(product: Product) -> bool:
    return url_has_extension(product.model_fbx, ".fbx")


def q_product_has_glb() -> Q:
    """Как раньше в админке: непустой model_glb (бейдж строже — см. product_has_glb)."""
    return Q(model_glb__isnull=False) & ~Q(model_glb="")


def q_product_has_rfa() -> Q:
    return (
        Q(model_rfa__isnull=False)
        & ~Q(model_rfa="")
        & (Q(model_rfa__iregex=r"\.rfa(\?|$)") | Q(model_rfa__icontains=".rfa?"))
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
    return (
        Q(model_fbx__isnull=False)
        & ~Q(model_fbx="")
        & (Q(model_fbx__iregex=r"\.fbx(\?|$)") | Q(model_fbx__icontains=".fbx?"))
    )


def product_model_files_q_components():
    """Условия для GLB / RFA / IFC (как счётчики папок и bundle)."""
    return q_product_has_glb(), q_product_has_rfa(), q_product_has_ifc()
