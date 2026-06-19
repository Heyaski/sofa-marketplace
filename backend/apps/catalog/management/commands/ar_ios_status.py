"""Диагностика AR на iPhone: Blender, конвертер, пример товара с GLB."""
from django.core.management.base import BaseCommand

from apps.catalog.catalog_glb_q import catalog_has_glb_q
from apps.catalog.glb_to_usdz_converter import (
    _blender_bin,
    _blender_usd_export_available,
    _BLENDER_SCRIPT,
    _usdz_storage_key,
    converter_is_configured,
    product_can_ios_ar,
)
from apps.catalog.models import Product
from django.core.files.storage import default_storage


class Command(BaseCommand):
    help = "Проверка GLB→USDZ для AR на iPhone (без Docker)."

    def handle(self, *args, **options):
        blender = _blender_bin()
        self.stdout.write(f"Blender: {blender or 'НЕ НАЙДЕН'}")
        if blender:
            usd_ok = _blender_usd_export_available()
            self.stdout.write(
                f"Blender USD export: {'OK' if usd_ok else 'НЕТ (apt blender без USD — install_blender_usd.sh)'}"
            )
        self.stdout.write(f"Скрипт: {_BLENDER_SCRIPT} ({'OK' if _BLENDER_SCRIPT.is_file() else 'НЕ НАЙДЕН'})")
        self.stdout.write(f"Конвертер настроен: {converter_is_configured()}")

        sample = (
            Product.objects.filter(is_active=True)
            .filter(catalog_has_glb_q())
            .order_by("id")
            .first()
        )
        if not sample:
            self.stdout.write(self.style.ERROR("Нет активных товаров с GLB"))
            return

        self.stdout.write(f"Пример товара с GLB: id={sample.id} «{sample.title[:60]}»")
        self.stdout.write(f"ios_ar_available: {product_can_ios_ar(sample)}")
        cached = default_storage.exists(_usdz_storage_key(sample.pk))
        self.stdout.write(f"USDZ в storage: {cached}")
        self.stdout.write("")
        self.stdout.write("Проверка API:")
        self.stdout.write(f"  curl -I https://api.vizhub.pro/api/products/{sample.id}/ar-usdz/")
        self.stdout.write("")
        self.stdout.write("Ручная конвертация одного товара:")
        self.stdout.write(f"  python manage.py convert_product_usdz --id={sample.id}")
