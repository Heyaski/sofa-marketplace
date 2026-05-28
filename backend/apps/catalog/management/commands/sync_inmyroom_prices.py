"""
Обновить price и availability у товаров по данным с INMYROOM.ru.

Оптимизации:
- по умолчанию только товары с shop_url inmyroom или артикулом IMR-*;
- одна HTTP-загрузка на уникальную карточку (варианты IMR-123(1), IMR-123WHT → одна страница);
- --workers для параллельных запросов (осторожно с нагрузкой на INMYROOM).

Ежедневный запуск: deploy/cron/README.md

  python manage.py sync_inmyroom_prices --sleep 0.3 --workers 4 --set-shop-url
  python manage.py sync_inmyroom_prices --dry-run --verbose
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.inmyroom_price import (
    InmyroomPageData,
    create_inmyroom_session,
    resolve_inmyroom_url,
    inmyroom_skip_reason,
    warm_up_inmyroom_session,
    fetch_inmyroom_page_data,
    is_inmyroom_product_url,
    build_inmyroom_url_from_article,
    filter_products_for_inmyroom_sync,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Подтянуть цены и наличие с INMYROOM.ru (с дедупликацией карточек и фильтром IMR)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, что бы изменилось, без сохранения",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.3,
            help="Пауза после каждого HTTP-запроса к INMYROOM, сек (по умолчанию 0.3)",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=4,
            help="Параллельных загрузок карточек (по умолчанию 4; при 1 — последовательно)",
        )
        parser.add_argument(
            "--article",
            type=str,
            default="",
            help="Обработать только товар с этим артикулом",
        )
        parser.add_argument(
            "--set-shop-url",
            action="store_true",
            help="Если shop_url пустой, записать вычисленную ссылку на INMYROOM",
        )
        parser.add_argument(
            "--all-products",
            action="store_true",
            help="Сканировать все товары, а не только с IMR/inmyroom в артикуле или shop_url",
        )
        parser.add_argument(
            "--include-inactive",
            action="store_true",
            help="Включить неактивные товары (is_active=False)",
        )
        parser.add_argument(
            "--save-every",
            type=int,
            default=500,
            help="Сохранять в БД каждые N обновлённых товаров (0 — только в конце)",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Вывести примеры пропущенных товаров (почему нет URL)",
        )
        parser.add_argument(
            "--verbose-limit",
            type=int,
            default=25,
            help="Сколько строк показать с --verbose (по умолчанию 25)",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        sleep_s = max(0.0, options["sleep"])
        workers = max(1, options["workers"])
        article_filter = (options["article"] or "").strip()
        set_shop_url = options["set_shop_url"]
        all_products = options["all_products"]
        include_inactive = options["include_inactive"]
        save_every = max(0, options["save_every"])
        verbose = options["verbose"]
        verbose_limit = max(1, options["verbose_limit"])

        qs = Product.objects.all().order_by("id")
        if not include_inactive:
            qs = qs.filter(is_active=True)
        if article_filter:
            qs = qs.filter(article__iexact=article_filter)
        elif not all_products:
            qs = filter_products_for_inmyroom_sync(qs)

        total_in_db = qs.count()
        if total_in_db == 0:
            self.stdout.write(self.style.WARNING("Нет товаров в выборке (проверьте фильтры)."))
            return

        self.stdout.write("Собираю карточки INMYROOM (группировка по URL)…")
        self.stdout.flush()

        by_url: dict[str, list[Product]] = defaultdict(list)
        skipped: list[tuple[Product, str]] = []

        for product in qs.iterator(chunk_size=500):
            url = resolve_inmyroom_url(product)
            if not url:
                skipped.append((product, inmyroom_skip_reason(product)))
                continue
            by_url[url].append(product)

        unique_cards = len(by_url)
        linked_products = sum(len(v) for v in by_url.values())
        self.stdout.write(
            f"В выборке БД: {total_in_db} товаров → уникальных карточек INMYROOM: {unique_cards} "
            f"(привязано товаров: {linked_products}). "
            f"Пауза после запроса: {sleep_s}s, потоков: {workers}."
        )
        if unique_cards == 0:
            self.stdout.write(self.style.WARNING("Нет карточек для загрузки."))
            return

        est_sec = unique_cards * sleep_s / workers if workers else unique_cards * sleep_s
        self.stdout.write(
            f"Оценка времени загрузки: ~{int(est_sec // 60)} мин "
            f"(без учёта ответа сайта)."
        )
        self.stdout.write("Подключаюсь к INMYROOM…")
        self.stdout.flush()

        rate_lock = threading.Lock()
        page_cache: dict[str, InmyroomPageData] = {}
        errors: list[tuple[str, str]] = []

        def fetch_card(url: str) -> tuple[str, InmyroomPageData | None, str | None]:
            session = create_inmyroom_session()
            try:
                data = fetch_inmyroom_page_data(url, session=session)
                if sleep_s:
                    with rate_lock:
                        time.sleep(sleep_s)
                return url, data, None
            except Exception as e:
                if sleep_s:
                    with rate_lock:
                        time.sleep(sleep_s)
                return url, None, str(e)
            finally:
                session.close()

        urls = list(by_url.keys())
        done_cards = 0

        if workers == 1:
            session = create_inmyroom_session()
            warm_up_inmyroom_session(session)
            try:
                for url in urls:
                    done_cards += 1
                    if done_cards == 1 or done_cards % 10 == 0 or done_cards == unique_cards:
                        self.stdout.write(f"  … карточка {done_cards}/{unique_cards}")
                        self.stdout.flush()
                    try:
                        page_cache[url] = fetch_inmyroom_page_data(url, session=session)
                    except Exception as e:
                        errors.append((url, str(e)))
                    if sleep_s:
                        time.sleep(sleep_s)
            finally:
                session.close()
        else:
            warm_session = create_inmyroom_session()
            try:
                warm_up_inmyroom_session(warm_session)
            finally:
                warm_session.close()
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = {pool.submit(fetch_card, url): url for url in urls}
                for fut in as_completed(futures):
                    done_cards += 1
                    if done_cards == 1 or done_cards % 10 == 0 or done_cards == unique_cards:
                        self.stdout.write(f"  … карточка {done_cards}/{unique_cards}")
                        self.stdout.flush()
                    url, data, err = fut.result()
                    if err:
                        errors.append((url, err))
                    else:
                        page_cache[url] = data

        updated_count = 0
        pending: list[Product] = []

        def flush_pending() -> None:
            nonlocal pending, updated_count
            if dry or not pending:
                pending = []
                return
            with transaction.atomic():
                Product.objects.bulk_update(
                    pending,
                    ["price", "availability", "shop_url"],
                    batch_size=100,
                )
            updated_count += len(pending)
            pending = []

        for url, products in by_url.items():
            page = page_cache.get(url)
            if page is None:
                continue
            for product in products:
                new_shop = None
                if set_shop_url and not (
                    product.shop_url and is_inmyroom_product_url(product.shop_url)
                ):
                    new_shop = (
                        build_inmyroom_url_from_article(product.article)
                        if product.article
                        else None
                    )

                old_price = product.price
                old_availability = product.availability
                changed = old_price != page.price
                if page.availability and page.availability != old_availability:
                    changed = True
                if new_shop and not product.shop_url:
                    changed = True

                if dry and changed:
                    line = (
                        f"id={product.pk} article={product.article!r} url={url} "
                        f"price {old_price} -> {page.price}"
                    )
                    if page.availability and page.availability != old_availability:
                        line += f" | availability {old_availability} -> {page.availability}"
                    if new_shop and not product.shop_url:
                        line += f" | shop_url -> {new_shop}"
                    self.stdout.write(line)
                elif changed:
                    product.price = page.price
                    if page.availability:
                        product.availability = page.availability
                    if new_shop and not product.shop_url:
                        product.shop_url = new_shop
                    pending.append(product)
                    if save_every and len(pending) >= save_every:
                        flush_pending()

        flush_pending()

        self.stdout.write(self.style.SUCCESS(f"Готово. Обновлено товаров: {updated_count if not dry else 0}."))
        self.stdout.write(
            f"Загружено карточек: {len(page_cache)}/{unique_cards}, "
            f"пропущено без URL: {len(skipped)}."
        )
        if skipped and verbose:
            self.stdout.write("Примеры без URL (id, article, причина):")
            for prod, reason in skipped[:verbose_limit]:
                self.stdout.write(
                    f"  id={prod.pk} article={prod.article!r} title={prod.title[:60]!r} | {reason}"
                )
            if len(skipped) > verbose_limit:
                self.stdout.write(f"  ... ещё {len(skipped) - verbose_limit}")
        if errors:
            self.stdout.write(self.style.ERROR(f"Ошибок загрузки: {len(errors)}"))
            for url, msg in errors[:20]:
                self.stdout.write(f"  {url}: {msg}")
            if len(errors) > 20:
                self.stdout.write(f"  ... ещё {len(errors) - 20}")
