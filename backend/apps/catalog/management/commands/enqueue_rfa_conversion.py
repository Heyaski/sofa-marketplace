from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.catalog.models import Product
from apps.catalog.tasks import convert_rfa_to_glb_task


class Command(BaseCommand):
    help = "Поставить в очередь конвертацию существующих RFA -> GLB превью"

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Обработать все товары с RFA (включая уже имеющие превью)",
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

        qs = Product.objects.filter(~Q(model_rfa=""), model_rfa__isnull=False).filter(
            Q(model_rfa__iendswith=".rfa") | Q(model_rfa__icontains=".rfa?")
        ).order_by("id")
        if only_failed:
            qs = qs.filter(model_rfa_convert_status="failed")
        elif not include_all:
            qs = qs.filter(Q(model_rfa_glb_preview="") | Q(model_rfa_glb_preview__isnull=True))

        if limit:
            products = list(qs[:limit])
        else:
            products = list(qs)

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
                convert_rfa_to_glb_task.apply(args=[product.pk])
            else:
                convert_rfa_to_glb_task.delay(product.pk)
            queued += 1

        self.stdout.write(self.style.SUCCESS(f"Готово. Поставлено задач: {queued}"))

