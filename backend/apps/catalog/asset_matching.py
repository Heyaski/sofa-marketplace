"""Сопоставление FileAsset ↔ Product (артикул, model_3d_asset_ids, код в названии)."""
from __future__ import annotations

import re

from django.db.models import Q

from apps.catalog.models import Product


def asset_id_search_variants(token: str) -> list[str]:
    """Те же варианты ID, что при импорте (пробелы, слитная кириллица)."""
    raw = (token or "").strip()
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
    return [k for k in keys if k and len(k) >= 2]


def title_tokens_for_asset_match(title: str | None) -> list[str]:
    """
    Фрагменты названия, похожие на внутренние коды (Тумба1343, Стол4617).
    Когда в Excel model_3d_asset_ids не совпадает с asset_id файла на S3.
    """
    t = (title or "").strip()
    if not t:
        return []
    out: set[str] = set()
    for part in re.split(r"[\s,;/|()]+", t):
        p = part.strip()
        if len(p) < 4:
            continue
        if not re.search(r"\d", p):
            continue
        out.update(asset_id_search_variants(p))
    return list(out)


def file_asset_lookup_q(asset_id: str) -> Q:
    """Q для поиска товара по asset_id файла (артикул / model_3d_asset_ids / код в title)."""
    aid = (asset_id or "").strip()
    if not aid:
        return Q(pk__in=[])

    q = Q(article__iexact=aid)
    for variant in asset_id_search_variants(aid):
        q |= Q(article__iexact=variant)
        q |= Q(model_3d_asset_ids__iexact=variant)
        q |= Q(model_3d_asset_ids__istartswith=f"{variant},")
        q |= Q(model_3d_asset_ids__iendswith=f",{variant}")
        q |= Q(model_3d_asset_ids__icontains=f",{variant},")
        q |= Q(title__icontains=variant)
        q |= Q(model_glb__iexact=variant)

    return q


def find_product_for_file_asset_id(asset_id: str) -> Product | None:
    """Найти товар для FileAsset: артикул, model_3d_asset_ids, код из названия."""
    aid = (asset_id or "").strip()
    if not aid:
        return None

    product = Product.objects.filter(file_asset_lookup_q(aid)).first()
    if product:
        return product

    base = aid.split("(")[0].strip()
    if base and base != aid:
        product = Product.objects.filter(file_asset_lookup_q(base)).first()
        if product:
            return product

    return None
