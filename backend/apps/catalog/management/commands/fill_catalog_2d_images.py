"""
Заполнить 2D-каталог: стабильные GLB URL → PNG-превью для всех товаров с моделью.

Порядок:
1. catalog_2d_status (до)
2. backfill_model_glb_from_assets — убрать протухшие CDN из model_glb
3. generate_2d_from_glb — PNG в Product.image
4. catalog_2d_status (после)
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Подготовить весь каталог к режиму 2D: backfill GLB + генерация PNG из GLB. "
        "Товары без GLB в БД останутся без фото — нужен импорт/синхронизация FileAsset."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-backfill",
            action="store_true",
            help="Не запускать backfill_model_glb_from_assets",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Перегенерировать PNG даже если фото уже есть",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=1,
            help="Параллельные процессы для generate_2d_from_glb (по умолчанию 1)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Лимит товаров для generate_2d_from_glb (для теста)",
        )
        parser.add_argument(
            "--matplotlib",
            action="store_true",
            help="Рендер без Playwright (быстрее, хуже качество)",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== До ==="))
        call_command("catalog_2d_status")

        if not options["skip_backfill"]:
            self.stdout.write(self.style.MIGRATE_HEADING("\n=== Backfill model_glb ==="))
            call_command("backfill_model_glb_from_assets")

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Генерация PNG из GLB ==="))
        gen_kwargs = {
            "force": options["force"],
            "workers": max(1, options["workers"]),
        }
        if options["limit"] is not None:
            gen_kwargs["limit"] = options["limit"]
        if options["matplotlib"]:
            gen_kwargs["matplotlib"] = True
        call_command("generate_2d_from_glb", **gen_kwargs)

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== После ==="))
        call_command("catalog_2d_status")
        self.stdout.write(
            self.style.SUCCESS(
                "\nГотово. Пересоберите фронт (кэш каталога v6) и обновите сайт (Ctrl+Shift+R)."
            )
        )
