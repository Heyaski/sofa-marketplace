"""Поставить в очередь GLB→USDZ для AR на iPhone (существующий каталог)."""
from django.core.management.base import BaseCommand

from apps.catalog.catalog_glb_q import catalog_has_glb_q
from apps.catalog.glb_to_usdz_converter import maybe_queue_glb_to_usdz
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Очередь Celery: конвертация GLB→USDZ для AR Quick Look на iPhone."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0, help="Макс. товаров (0 = все)")

    def handle(self, *args, **options):
        qs = Product.objects.filter(is_active=True).filter(catalog_has_glb_q())
        limit = int(options["limit"] or 0)
        if limit > 0:
            qs = qs[:limit]

        queued = 0
        for product in qs.iterator(chunk_size=200):
            maybe_queue_glb_to_usdz(product)
            queued += 1
        self.stdout.write(self.style.SUCCESS(f"Поставлено в очередь: {queued} товаров с GLB"))
