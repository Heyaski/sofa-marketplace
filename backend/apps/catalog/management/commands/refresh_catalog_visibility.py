"""Пересчитать catalog_visible_2d / catalog_visible_3d (как фильтры API и админки)."""
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.catalog.catalog_visibility import bulk_refresh_catalog_visibility_flags
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Синхронизировать catalog_visible_2d/3d с правилами сайта (catalog_has_glb_q, фото 2D)"

    def add_arguments(self, parser):
        parser.add_argument("--category-id", type=int, default=0)
        parser.add_argument("--only-active", action="store_true", default=True)

    def handle(self, *args, **options):
        qs = Product.objects.all()
        if options["only_active"]:
            qs = qs.filter(is_active=True)
        cat_id = options["category_id"]
        if cat_id:
            qs = qs.filter(Q(category_id=cat_id) | Q(category__parent_id=cat_id))

        total = qs.count()
        stats = bulk_refresh_catalog_visibility_flags(qs)
        self.stdout.write(
            self.style.SUCCESS(
                f"Готово ({total} товаров). 3D: +{stats['visible_3d_set']} / −{stats['visible_3d_cleared']} | "
                f"2D: +{stats['visible_2d_set']} / −{stats['visible_2d_cleared']}"
            )
        )
