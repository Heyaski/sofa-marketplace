"""Пересчитать catalog_visible_2d / catalog_visible_3d для быстрого list API."""
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.catalog.catalog_visibility import (
    product_is_catalog_visible_2d,
    product_is_catalog_visible_3d,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Обновить флаги catalog_visible_2d/3d (после миграции или массового импорта)"

    def add_arguments(self, parser):
        parser.add_argument("--category-id", type=int, default=0)
        parser.add_argument("--only-active", action="store_true", default=True)
        parser.add_argument("--chunk", type=int, default=500)

    def handle(self, *args, **options):
        qs = Product.objects.all()
        if options["only_active"]:
            qs = qs.filter(is_active=True)
        cat_id = options["category_id"]
        if cat_id:
            qs = qs.filter(Q(category_id=cat_id) | Q(category__parent_id=cat_id))

        chunk = max(100, options["chunk"])
        seen = 0
        changed = 0
        batch_3d_true: list[int] = []
        batch_3d_false: list[int] = []
        batch_2d_true: list[int] = []
        batch_2d_false: list[int] = []

        def flush():
            nonlocal changed
            if batch_3d_true:
                Product.objects.filter(pk__in=batch_3d_true).update(catalog_visible_3d=True)
                changed += len(batch_3d_true)
                batch_3d_true.clear()
            if batch_3d_false:
                Product.objects.filter(pk__in=batch_3d_false).update(catalog_visible_3d=False)
                changed += len(batch_3d_false)
                batch_3d_false.clear()
            if batch_2d_true:
                Product.objects.filter(pk__in=batch_2d_true).update(catalog_visible_2d=True)
                changed += len(batch_2d_true)
                batch_2d_true.clear()
            if batch_2d_false:
                Product.objects.filter(pk__in=batch_2d_false).update(catalog_visible_2d=False)
                changed += len(batch_2d_false)
                batch_2d_false.clear()

        for product in qs.iterator(chunk_size=chunk):
            seen += 1
            v3 = product_is_catalog_visible_3d(product)
            v2 = product_is_catalog_visible_2d(product)
            if product.catalog_visible_3d != v3:
                (batch_3d_true if v3 else batch_3d_false).append(product.pk)
            if product.catalog_visible_2d != v2:
                (batch_2d_true if v2 else batch_2d_false).append(product.pk)
            if len(batch_3d_true) + len(batch_3d_false) + len(batch_2d_true) + len(batch_2d_false) >= chunk:
                flush()
            if seen % 2000 == 0:
                self.stdout.write(f"  … {seen}")

        flush()
        self.stdout.write(self.style.SUCCESS(f"Готово: просмотрено {seen}, обновлено полей (строк): {changed}"))
