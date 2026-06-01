"""
Опубликовать товары на витрину после заливки FileAsset (SFTP / админка).

  python manage.py publish_catalog_assets --category-id 14
  python manage.py publish_catalog_assets --category-id 14 --link-orphans
  python manage.py publish_catalog_assets --category-id 14 --verbose --generate-2d --workers 2
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.catalog.catalog_asset_publish import (
    backfill_queryset,
    catalog_visibility_counts,
    diagnose_category_vs_pouf,
    format_counts,
    link_orphan_glb_assets,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Backfill model_glb/rfa/ifc из S3 FileAsset и показать, сколько товаров видно в 2D/3D"

    def add_arguments(self, parser):
        parser.add_argument("--category-id", type=int, default=None)
        parser.add_argument("--category", type=str, default="", help="Подстрока в названии категории")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--link-orphans",
            action="store_true",
            help="Обратная привязка: каждый GLB FileAsset → товар (как у пуфов)",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Примеры полей vs рабочий пуф",
        )
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

        if options["verbose"] and category_id is not None:
            self.stdout.write(self.style.MIGRATE_HEADING("Сравнение с рабочим пуфом"))
            for line in diagnose_category_vs_pouf(category_id):
                self.stdout.write(line)
            self.stdout.write("")

        before = catalog_visibility_counts(qs)
        self.stdout.write(format_counts("До", before))

        if options["link_orphans"]:
            stats = link_orphan_glb_assets(
                category_id=category_id,
                dry_run=options["dry_run"],
            )
            self.stdout.write(
                f"Link orphans: scanned={stats['scanned']} "
                f"matched_in_category={stats['matched_in_category']} "
                f"linked={stats['linked']} "
                f"glb_without_product={stats['orphans_no_product']}"
            )

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

        self.stdout.write("Обновление флагов catalog_visible_2d/3d…")
        refresh_args = []
        if category_id is not None:
            refresh_args = ["--category-id", str(category_id)]
        call_command("refresh_catalog_visibility", *refresh_args)
        after_flags = catalog_visibility_counts(qs)
        self.stdout.write(format_counts("После флагов", after_flags))

        if options["generate_2d"]:
            self.stdout.write("Генерация 2D-превью из GLB…")
            call_command("generate_2d_from_glb", workers=max(1, options["workers"]))
            final = catalog_visibility_counts(qs)
            self.stdout.write(format_counts("После 2D", final))

        if after["visible_3d"] == 0 and before["total"] > 0:
            self.stdout.write(
                self.style.WARNING(
                    "На витрине 3D = 0. Категория в БД есть (товары привязаны), но нет связки "
                    "FileAsset ↔ товар. Имена файлов должны совпадать с кодом в title/model_3d_asset_ids "
                    "(как Пуф1510.glb у пуфов), либо с артикулом IMR-* без суффикса цвета."
                )
            )
