"""
Обновить поле price у товаров по актуальным ценам с INMYROOM.ru.

Для каждого товара URL страницы берётся из shop_url (если это ссылка на карточку inmyroom),
иначе строится из артикула IMR-XXXXXXXX: https://www.inmyroom.ru/products/<цифры>-

Ежедневный запуск на сервере: см. `deploy/cron/README.md` (crontab или systemd timer).

Запуск из каталога backend:
  python manage.py sync_inmyroom_prices
  python manage.py sync_inmyroom_prices --dry-run
  python manage.py sync_inmyroom_prices --sleep 2 --article IMR-556065
"""
import time

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.inmyroom_price import (
    create_inmyroom_session,
    resolve_inmyroom_url,
    inmyroom_skip_reason,
    warm_up_inmyroom_session,
    fetch_inmyroom_price_rub,
    is_inmyroom_product_url,
    build_inmyroom_url_from_article,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Подтянуть цены с INMYROOM.ru по shop_url или артикулу IMR-*"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, что бы изменилось, без сохранения",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=1.0,
            help="Пауза между HTTP-запросами, сек (по умолчанию 1)",
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
        article_filter = (options["article"] or "").strip()
        set_shop_url = options["set_shop_url"]
        verbose = options["verbose"]
        verbose_limit = max(1, options["verbose_limit"])

        qs = Product.objects.all().order_by("id")
        if article_filter:
            qs = qs.filter(article__iexact=article_filter)

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("Нет товаров в выборке (проверьте фильтры)."))
            return

        self.stdout.write(
            f"Товаров в выборке: {total}. Пауза между запросами: {sleep_s}s — при большом "
            "числе карточек с INMYROOM прогон может занять несколько минут."
        )
        self.stdout.write("Подключаюсь к INMYROOM (разогрев сессии)…")
        self.stdout.flush()

        session = create_inmyroom_session()
        warm_up_inmyroom_session(session)
        self.stdout.write("Сессия готова, обхожу каталог…")
        self.stdout.flush()

        updated = []
        skipped = []
        errors = []

        try:
            for n, product in enumerate(qs.iterator(chunk_size=100), start=1):
                if n == 1 or n % 10 == 0 or n == total:
                    self.stdout.write(f"  … позиция {n}/{total}")
                    self.stdout.flush()
                url = resolve_inmyroom_url(product)
                if not url:
                    skipped.append((product, inmyroom_skip_reason(product)))
                    continue

                new_shop = None
                if set_shop_url and not (product.shop_url and is_inmyroom_product_url(product.shop_url)):
                    new_shop = build_inmyroom_url_from_article(product.article) if product.article else None

                try:
                    price = fetch_inmyroom_price_rub(url, session=session)
                except Exception as e:
                    errors.append((product.pk, product.article or "", str(e)))
                    if sleep_s:
                        time.sleep(sleep_s)
                    continue

                old_price = product.price
                changed = old_price != price
                if new_shop and not product.shop_url:
                    changed = changed or True

                if dry:
                    line = (
                        f"id={product.pk} article={product.article!r} url={url} "
                        f"price {old_price} -> {price}"
                    )
                    if new_shop and not product.shop_url:
                        line += f" | shop_url -> {new_shop}"
                    self.stdout.write(line)
                else:
                    if changed:
                        product.price = price
                        if new_shop and not product.shop_url:
                            product.shop_url = new_shop
                        updated.append(product)

                if sleep_s:
                    time.sleep(sleep_s)

            if not dry and updated:
                with transaction.atomic():
                    Product.objects.bulk_update(
                        updated,
                        ["price", "shop_url"],
                        batch_size=100,
                    )

        finally:
            session.close()

        self.stdout.write(self.style.SUCCESS(f"Готово. Обновлено: {len(updated) if not dry else 0}."))
        if skipped:
            self.stdout.write(self.style.WARNING(f"Пропущено (нет URL для парсинга): {len(skipped)}"))
            if verbose:
                self.stdout.write("Примеры (id, title, article, причина):")
                for prod, reason in skipped[:verbose_limit]:
                    self.stdout.write(
                        f"  id={prod.pk} article={prod.article!r} title={prod.title[:60]!r} | {reason}"
                    )
                if len(skipped) > verbose_limit:
                    self.stdout.write(f"  ... ещё {len(skipped) - verbose_limit}")
        if errors:
            self.stdout.write(self.style.ERROR(f"Ошибок: {len(errors)}"))
            for pid, art, msg in errors[:30]:
                self.stdout.write(f"  id={pid} article={art!r}: {msg}")
            if len(errors) > 30:
                self.stdout.write(f"  ... ещё {len(errors) - 30}")
