"""
Опубликовать товары на витрину после заливки FileAsset (SFTP / админка).

  python manage.py publish_catalog_assets --category-id 14
  python manage.py publish_catalog_assets --category-id 14 --generate-2d --workers 2
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.catalog.catalog_asset_publish import (
    backfill_queryset,
    catalog_visibility_counts,
    format_counts,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Backfill model_glb/rfa/ifc из S3 FileAsset и показать, сколько товаров видно в 2D/3D"

    def add_arguments(self, parser):
        parser.add_argument("--category-id", type=int, default=None)
        parser.add_argument("--category", type=str, default="", help="Подстрока в названии категории")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--generate-2d",
            action="store_true",
            help="После backfill запустить generate_2d_from_glb (долго)",
        )
        parser.add_argument("--workers", type=int, default=1, help="Workers для generate_2d_from_glb")
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        qs = Product.objects.filter(is_active=True).order_by("id")
        category_id = options.get("category_id")
        cat_needle = (options.get("category") or "").strip()
        if category_id is not None:
            qs = qs.filter(category_id=category_id)
        elif cat_needle:
            qs = qs.filter(category__name__icontains=cat_needle)

        limit = max(0, int(options.get("limit") or 0))
        if limit:
            qs = qs[:limit]

        before = catalog_visibility_counts(qs)
        self.stdout.write(format_counts("До", before))

        updated, seen = backfill_queryset(qs, dry_run=options["dry_run"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Backfill: обновлено {updated} из {seen}"
                + (" (dry-run)" if options["dry_run"] else "")
            )
        )

        if options["dry_run"]:
            return

        after = catalog_visibility_counts(qs)
        self.stdout.write(format_counts("После backfill", after))

        if options["generate_2d"]:
            self.stdout.write("Генерация 2D-превью из GLB…")
            gen_kwargs = {"workers": max(1, options["workers"])}
            if category_id is not None:
                # generate_2d не фильтрует категорию — ограничим по id товаров с GLB без фото
                pass
            call_command("generate_2d_from_glb", **gen_kwargs)
            final = catalog_visibility_counts(qs)
            self.stdout.write(format_counts("После 2D", final))

        if after["visible_3d"] == 0 and before["total"] > 0:
            self.stdout.write(
                self.style.WARNING(
                    "На витрине 3D по-прежнему 0: проверьте, что .glb в FileAsset "
                    "и имя файла совпадает с артикулом / кодом в title (Стол4617)."
                )
            )
