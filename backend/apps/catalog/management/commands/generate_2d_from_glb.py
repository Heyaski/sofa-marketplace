from django.core.management.base import BaseCommand

from apps.catalog.glb_2d_preview import product_lacks_catalog_2d, load_primary_glb_bytes, run_glb_2d_preview_for_product_id
from apps.catalog.models import Product


class Command(BaseCommand):
    help = (
        "Сгенерировать поле image (2D превью) из GLB/GLTF для товаров без фото. "
        "Файлы GLB не изменяются."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--product-id",
            type=int,
            default=None,
            help="Обработать только один товар по id",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Максимум успешно сгенерированных превью за запуск",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Перегенерировать даже если уже есть фото (перезапишет image)",
        )

    def handle(self, *args, **options):
        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]

        qs = Product.objects.all().order_by("id")
        if pid is not None:
            qs = qs.filter(pk=pid)

        done = 0
        skipped = 0
        errors = 0

        for product in qs.iterator(chunk_size=50):
            if not force and not product_lacks_catalog_2d(product):
                skipped += 1
                continue
            if not load_primary_glb_bytes(product):
                skipped += 1
                continue

            result = run_glb_2d_preview_for_product_id(product.pk, force=force)
            st = result.get("status")
            if st == "ok":
                done += 1
                self.stdout.write(self.style.SUCCESS(f"id={product.pk}: {result}"))
                if limit is not None and done >= limit:
                    break
            elif st == "error":
                errors += 1
                self.stdout.write(self.style.ERROR(f"id={product.pk}: {result}"))
            else:
                skipped += 1

        self.stdout.write(
            self.style.NOTICE(f"Готово: ok={done}, пропуск/прочее={skipped}, ошибок={errors}")
        )
