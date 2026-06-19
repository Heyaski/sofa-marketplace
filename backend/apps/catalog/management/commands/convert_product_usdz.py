"""Синхронно: GLB → USDZ для одного товара (тест AR на iPhone)."""
from django.core.management.base import BaseCommand, CommandError

from apps.catalog.catalog_glb_q import catalog_has_glb_q
from apps.catalog.glb_to_usdz_converter import (
    convert_glb_to_usdz_for_product,
    converter_is_configured,
    get_usdz_bytes_for_product,
    product_can_ios_ar,
    resolve_product_glb_ref,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = "Конвертировать GLB товара в USDZ для AR Quick Look (тест на сервере)."

    def add_arguments(self, parser):
        parser.add_argument("--id", type=int, help="ID товара (по умолчанию — первый с GLB)")

    def handle(self, *args, **options):
        if not converter_is_configured():
            raise CommandError(
                "Конвертер не настроен. Запустите backend/scripts/install_blender_usd.sh "
                "и задайте BLENDER_BIN в backend/.env"
            )

        product_id = options.get("id")
        if product_id:
            product = Product.objects.filter(pk=product_id, is_active=True).first()
            if not product:
                raise CommandError(f"Товар {product_id} не найден или неактивен")
        else:
            product = (
                Product.objects.filter(is_active=True)
                .filter(catalog_has_glb_q())
                .order_by("id")
                .first()
            )
            if not product:
                raise CommandError("Нет активных товаров с GLB")

        if not product_can_ios_ar(product):
            raise CommandError(f"Товар {product.pk} не подходит для iOS AR (нет GLB)")

        glb_ref = resolve_product_glb_ref(product)
        self.stdout.write(f"Товар {product.pk}: {product.title[:80]}")
        self.stdout.write(f"GLB: {glb_ref[:120]}...")
        self.stdout.write("Конвертация (может занять 1–3 мин)...")

        try:
            url = convert_glb_to_usdz_for_product(product.pk)
            size = len(get_usdz_bytes_for_product(product.pk))
        except Exception as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Готово: {url}"))
        self.stdout.write(self.style.SUCCESS(f"Размер USDZ: {size} байт"))
        self.stdout.write(f"Проверка: curl -I https://api.vizhub.pro/api/products/{product.pk}/ar-usdz/")
