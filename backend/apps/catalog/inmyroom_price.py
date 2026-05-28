"""
Получение актуальной цены и наличия товара с витрины INMYROOM по URL или артикулу IMR-XXXXXXXX.

Страница товара: https://www.inmyroom.ru/products/<числовой_id>-<slug>
Числовой_id совпадает с цифровой частью артикула IMR-556065 -> 556065.

Наличие берётся из JSON-LD (schema.org/InStock и т.п.) на той же странице, что и цена.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING, Any, Iterator
from urllib.parse import urlparse

import requests

if TYPE_CHECKING:
    from apps.catalog.models import Product

IMR_HOSTS = frozenset(
    {
        "www.inmyroom.ru",
        "inmyroom.ru",
        "spb.inmyroom.ru",
        "msk.inmyroom.ru",
    }
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Значения поля Product.availability
AVAILABILITY_IN_STOCK = "in_stock"
AVAILABILITY_ON_ORDER = "on_order"
AVAILABILITY_OUT_OF_STOCK = "out_of_stock"

_SCHEMA_AVAILABILITY_TOKEN = {
    "instock": AVAILABILITY_IN_STOCK,
    "outofstock": AVAILABILITY_OUT_OF_STOCK,
    "preorder": AVAILABILITY_ON_ORDER,
    "backorder": AVAILABILITY_ON_ORDER,
    "discontinued": AVAILABILITY_OUT_OF_STOCK,
    "soldout": AVAILABILITY_OUT_OF_STOCK,
}


@dataclass(frozen=True)
class InmyroomPageData:
    price: Decimal
    availability: str | None


def base_imr_article(article: str) -> str:
    """Как в admin при импорте: IMR-556065(1) -> IMR-556065, IMR-1284569WHT -> IMR-1284569."""
    if not article:
        return ""
    s = article.strip()
    if "(" in s:
        return s.split("(")[0].strip()
    m = re.match(r"^(.+)([A-Z]{2,4})$", s.upper())
    if m and len(m.group(1)) >= 4:
        return m.group(1)
    return s


def imr_catalog_numeric_id(article: str) -> int | None:
    """
    Числовой id карточки на inmyroom.ru.
    Поддержка: IMR-556065, IMR556065, IMR 556065, imr_556065; после base_imr_article — суффиксы цвета.
    """
    if not article or not str(article).strip():
        return None
    base = base_imr_article(str(article).strip())
    normalized = re.sub(r"\s+", "", base.upper().replace("_", "-"))
    m = re.match(r"^IMR-?(\d{4,12})$", normalized)
    if m:
        return int(m.group(1))
    # Явный фрагмент IMR… в строке (если в ячейке мусор)
    m = re.search(r"IMR[\s_-]?(\d{4,12})", base.upper())
    if m:
        return int(m.group(1))
    # Только цифры — типичный id витрины (уменьшаем ложные срабатывания: от 6 знаков)
    if re.fullmatch(r"\d{6,12}", normalized):
        return int(normalized)
    return None


def is_inmyroom_product_url(url: str) -> bool:
    if not url:
        return False
    try:
        p = urlparse(url.strip())
    except Exception:
        return False
    if p.scheme not in ("http", "https"):
        return False
    host = (p.hostname or "").lower()
    if host not in IMR_HOSTS and not host.endswith(".inmyroom.ru"):
        return False
    path = (p.path or "").lower()
    return "/products/" in path and re.search(r"/products/\d+", path) is not None


def build_inmyroom_url_from_article(article: str) -> str | None:
    nid = imr_catalog_numeric_id(article)
    if not nid:
        return None
    return f"https://www.inmyroom.ru/products/{nid}-"


def canonical_inmyroom_url(url: str) -> str:
    """Один ключ на карточку витрины (варианты IMR-* и разные slug → один id)."""
    m = re.search(r"/products/(\d+)", url or "", re.I)
    if m:
        return f"https://www.inmyroom.ru/products/{m.group(1)}-"
    return (url or "").strip()


def resolve_inmyroom_url(product: Product) -> str | None:
    if product.shop_url and is_inmyroom_product_url(product.shop_url):
        return canonical_inmyroom_url(product.shop_url.strip())
    if product.article:
        built = build_inmyroom_url_from_article(product.article)
        return canonical_inmyroom_url(built) if built else None
    return None


def filter_products_for_inmyroom_sync(qs):
    """
    Товары, у которых теоретически есть карточка INMYROOM (без HTTP).
    Сужает выборку перед массовым парсингом.
    """
    from django.db.models import Q

    return qs.filter(
        Q(shop_url__icontains="inmyroom.ru")
        | Q(article__iregex=r"^IMR")
        | Q(article__iregex=r"IMR[\s_-]?\d")
    ).distinct()


def inmyroom_skip_reason(product: Product) -> str:
    """Человекочитаемая причина, почему resolve_inmyroom_url вернул None."""
    su = (product.shop_url or "").strip()
    if su and not is_inmyroom_product_url(su):
        return (
            "shop_url задан, но это не карточка товара INMYROOM (/products/<id>-...); "
            f"первые 80 символов: {su[:80]}"
        )
    if not (product.article or "").strip():
        return "пустой артикул и нет подходящего shop_url"
    if build_inmyroom_url_from_article(product.article) is None:
        return (
            "артикул не похож на IMR / id витрины; задайте shop_url на карточку или артикул вида IMR-123456 "
            f"(сейчас: {product.article!r})"
        )
    return "неизвестно"


def _iter_ld_json_blocks(html: str) -> Iterator[dict[str, Any]]:
    for m in re.finditer(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.I | re.DOTALL,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    yield item
        elif isinstance(data, dict):
            yield data


def _schema_availability_token(raw: str) -> str | None:
    """schema.org/InStock, https://schema.org/OutOfStock -> in_stock / out_of_stock."""
    if not raw or not str(raw).strip():
        return None
    token = str(raw).strip().rstrip("/").split("/")[-1].lower()
    token = re.sub(r"[^a-z]", "", token)
    return _SCHEMA_AVAILABILITY_TOKEN.get(token)


def _availability_from_offers(offers: Any) -> str | None:
    if isinstance(offers, dict):
        if str(offers.get("@type") or "").lower() == "aggregateoffer":
            return _availability_from_offers(offers.get("offers"))
        av = offers.get("availability")
        if av is not None:
            return _schema_availability_token(str(av))
        return None
    if isinstance(offers, list):
        for item in offers:
            if not isinstance(item, dict):
                continue
            val = _availability_from_offers(item)
            if val:
                return val
    return None


def parse_inmyroom_availability(html: str) -> str | None:
    """in_stock | on_order | out_of_stock или None, если вёрстка не распознана."""
    if not html:
        return None

    for item in _iter_ld_json_blocks(html):
        item_type = str(item.get("@type") or "")
        if item_type.lower() == "product" or "offers" in item:
            val = _availability_from_offers(item.get("offers"))
            if val:
                return val

    for item in _iter_ld_json_blocks(html):
        val = _availability_from_offers(item.get("offers"))
        if val:
            return val

    low = html.lower()
    if re.search(r"нет\s+в\s+налич", low):
        return AVAILABILITY_OUT_OF_STOCK
    if re.search(r"под\s+заказ", low):
        return AVAILABILITY_ON_ORDER
    if re.search(r"в\s+налич", low):
        return AVAILABILITY_IN_STOCK
    return None


def _normalize_rub_amount(raw: str) -> Decimal | None:
    s = raw.replace("\u00a0", " ").replace(" ", "").strip()
    if not s.isdigit():
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def parse_inmyroom_price_rub(html: str) -> Decimal | None:
    if not html:
        return None

    # <meta content="..." property="og:title" /> (порядок атрибутов на сайте)
    for prop in ("og:title", "og:description"):
        m = re.search(
            rf'content="([^"]+)"[^>]*property="{re.escape(prop)}"',
            html,
            re.I,
        )
        if not m:
            m = re.search(
                rf'property="{re.escape(prop)}"[^>]*content="([^"]+)"',
                html,
                re.I,
            )
        if m:
            chunk = m.group(1)
            for pat in (
                r"по цене\s*(\d[\d\s]*)",
                r"(\d[\d\s]*)\s*руб",
            ):
                pm = re.search(pat, chunk, re.I)
                if pm:
                    val = _normalize_rub_amount(pm.group(1))
                    if val is not None:
                        return val

    m = re.search(
        r'<meta\s+name="description"[^>]*content="([^"]+)"',
        html,
        re.I,
    )
    if m:
        chunk = m.group(1)
        for pat in (r"по цене\s*(\d[\d\s]*)", r"(\d[\d\s]*)\s*руб"):
            pm = re.search(pat, chunk, re.I)
            if pm:
                val = _normalize_rub_amount(pm.group(1))
                if val is not None:
                    return val

    # JSON-LD Product / Offer
    for item in _iter_ld_json_blocks(html):
        offers = item.get("offers")
        if isinstance(offers, dict):
            price = offers.get("price")
            if price is not None:
                try:
                    return Decimal(str(price).replace(",", "."))
                except InvalidOperation:
                    pass
            nested = offers.get("offers")
            if isinstance(nested, list) and nested:
                o0 = nested[0]
                if isinstance(o0, dict) and o0.get("price") is not None:
                    try:
                        return Decimal(str(o0["price"]).replace(",", "."))
                    except InvalidOperation:
                        pass
        elif isinstance(offers, list) and offers:
            o0 = offers[0]
            if isinstance(o0, dict) and o0.get("price") is not None:
                try:
                    return Decimal(str(o0["price"]).replace(",", "."))
                except InvalidOperation:
                    pass

    # Последний fallback: первая «по цене N» в документе
    m = re.search(r"по цене\s*(\d[\d\s]*)", html, re.I)
    if m:
        return _normalize_rub_amount(m.group(1))
    return None


def create_inmyroom_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        }
    )
    return s


def warm_up_inmyroom_session(session: requests.Session, timeout: float = 20.0) -> None:
    session.get("https://www.inmyroom.ru/", timeout=timeout)


def fetch_inmyroom_page_data(
    url: str,
    session: requests.Session | None = None,
    timeout: float = 30.0,
) -> InmyroomPageData:
    own = session is None
    if session is None:
        session = create_inmyroom_session()
        warm_up_inmyroom_session(session, timeout=timeout)
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        html = r.text
        price = parse_inmyroom_price_rub(html)
        if price is None:
            raise ValueError("Не удалось извлечь цену из HTML (сменилась вёрстка или нет доступа к странице).")
        return InmyroomPageData(price=price, availability=parse_inmyroom_availability(html))
    finally:
        if own:
            session.close()


def fetch_inmyroom_price_rub(url: str, session: requests.Session | None = None, timeout: float = 30.0) -> Decimal:
    return fetch_inmyroom_page_data(url, session=session, timeout=timeout).price
