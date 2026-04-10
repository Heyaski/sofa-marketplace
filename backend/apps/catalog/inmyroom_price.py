"""
Получение актуальной цены товара с витрины INMYROOM по URL или артикулу IMR-XXXXXXXX.

Страница товара: https://www.inmyroom.ru/products/<числовой_id>-<slug>
Числовой_id совпадает с цифровой частью артикула IMR-556065 -> 556065.
"""
from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import TYPE_CHECKING
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


def resolve_inmyroom_url(product: Product) -> str | None:
    if product.shop_url and is_inmyroom_product_url(product.shop_url):
        return product.shop_url.strip()
    if product.article:
        return build_inmyroom_url_from_article(product.article)
    return None


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
        for item in data if isinstance(data, list) else [data]:
            if not isinstance(item, dict):
                continue
            offers = item.get("offers")
            if isinstance(offers, dict):
                price = offers.get("price")
                if price is not None:
                    try:
                        return Decimal(str(price).replace(",", "."))
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


def fetch_inmyroom_price_rub(url: str, session: requests.Session | None = None, timeout: float = 30.0) -> Decimal:
    own = session is None
    if session is None:
        session = create_inmyroom_session()
        warm_up_inmyroom_session(session, timeout=timeout)
    try:
        r = session.get(url, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        price = parse_inmyroom_price_rub(r.text)
        if price is None:
            raise ValueError("Не удалось извлечь цену из HTML (сменилась вёрстка или нет доступа к странице).")
        return price
    finally:
        if own:
            session.close()
