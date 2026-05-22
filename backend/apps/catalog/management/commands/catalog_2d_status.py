"""Сводка по 2D-превью каталога и что делать дальше."""

from django.core.management.base import BaseCommand

from apps.catalog.glb_2d_preview import collect_catalog_2d_stats


class Command(BaseCommand):
    help = "Показать, сколько товаров с фото 2D, сколько ждут generate_2d_from_glb, сколько без GLB."

    def handle(self, *args, **options):
        s = collect_catalog_2d_stats()
        self.stdout.write(self.style.MIGRATE_HEADING("2D-каталог (активные товары)"))
        self.stdout.write(f"  Всего активных:           {s['total_active']}")
        self.stdout.write(f"  Уже с фото 2D:            {s['with_2d_image']}")
        self.stdout.write(f"  С GLB в БД:               {s['with_glb_in_db']}")
        self.stdout.write(
            self.style.WARNING(
                f"  Нужен PNG из GLB:         {s['needs_png_from_glb']}  "
                "→ python manage.py generate_2d_from_glb"
            )
        )
        self.stdout.write(
            self.style.ERROR(
                f"  Нет фото и нет GLB:       {s['no_glb_no_2d']}  "
                "→ админка FileAsset: «Синхронизация с товарами» / импорт файлов"
            )
        )

        if s["needs_png_from_glb"]:
            self.stdout.write("")
            self.stdout.write(
                "Полный прогон превью (все с GLB без фото):\n"
                "  python manage.py fill_catalog_2d_images\n"
                "или:\n"
                "  python manage.py backfill_model_glb_from_assets\n"
                "  python manage.py generate_2d_from_glb --workers 2"
            )
        if s["no_glb_no_2d"]:
            self.stdout.write("")
            self.stdout.write(
                "Для товаров без GLB generate_2d_from_glb не поможет — "
                "сначала привяжите .glb в FileAsset и синхронизируйте с товарами."
            )
