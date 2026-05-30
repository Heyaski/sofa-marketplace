"""
Заполнить model_glb / model_rfa / model_ifc URL-ами из FileAsset (S3).

  python manage.py backfill_model_formats_from_assets --category-id 14
  python manage.py backfill_model_formats_from_assets --dry-run --category-id 14
"""
from django.core.management.base import BaseCommand

from apps.catalog.catalog_asset_publish import backfill_queryset
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Подставить model_glb/rfa/ifc из FileAsset .glb/.rfa/.ifc"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--category", type=str, default="", help="Подстрока в названии категории")
        parser.add_argument("--category-id", type=int, default=None)
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        dry = options["dry_run"]
        cat_needle = (options["category"] or "").strip()
        category_id = options.get("category_id")
        limit = max(0, int(options["limit"] or 0))

        qs = Product.objects.filter(is_active=True).order_by("id")
        if category_id is not None:
            qs = qs.filter(category_id=category_id)
        elif cat_needle:
            qs = qs.filter(category__name__icontains=cat_needle)
        if limit:
            qs = qs[:limit]

        updated, seen = backfill_queryset(qs, dry_run=dry)
        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Обновлено: {updated}" + (" (dry-run)" if dry else "") + f", просмотрено: {seen}"
            )
        )
