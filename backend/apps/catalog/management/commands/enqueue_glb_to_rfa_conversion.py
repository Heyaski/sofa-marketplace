from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.catalog.models import Product
from apps.catalog.tasks import convert_glb_to_rfa_task


class Command(BaseCommand):
    help = "Поставить в очередь конвертацию существующих GLB -> RFA"

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Обработать все товары с GLB (включая уже имеющие RFA)",
        )
        parser.add_argument(
            "--only-failed",
            action="store_true",
            help="Обработать только товары со статусом failed",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Ограничить количество товаров (0 = без лимита)",
        )
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Выполнить синхронно в текущем процессе (для отладки)",
        )

    def handle(self, *args, **options):
        include_all = options["all"]
        only_failed = options["only_failed"]
        limit = max(0, options["limit"])
        run_sync = options["sync"]

        qs = Product.objects.filter(~Q(model_glb=""), model_glb__isnull=False).order_by("id")
        if only_failed:
            qs = qs.filter(model_rfa_convert_status="failed")
        elif not include_all:
            qs = qs.filter(Q(model_rfa="") | Q(model_rfa__isnull=True))

        products = list(qs[:limit]) if limit else list(qs)
        if not products:
            self.stdout.write(self.style.WARNING("Нет товаров для обработки по выбранным фильтрам."))
            return

        self.stdout.write(
            f"Найдено товаров: {len(products)} | режим: {'sync' if run_sync else 'queue'}"
        )

        queued = 0
        for product in products:
            Product.objects.filter(pk=product.pk).update(
                model_rfa_convert_status="queued",
                model_rfa_convert_error="",
            )
            if run_sync:
                convert_glb_to_rfa_task.apply(args=[product.pk])
            else:
                convert_glb_to_rfa_task.delay(product.pk)
            queued += 1

        self.stdout.write(self.style.SUCCESS(f"Готово. Поставлено задач: {queued}"))
