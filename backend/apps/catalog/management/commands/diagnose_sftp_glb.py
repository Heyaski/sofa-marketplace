"""Почему GLB с SFTP не виден в админке / на сайте — пошаговая диагностика."""
from __future__ import annotations

import os

from django.core.management.base import BaseCommand

from apps.catalog.asset_matching import find_product_for_file_asset_id
from apps.catalog.catalog_glb_q import catalog_has_glb_q, product_matches_catalog_has_glb_q
from apps.catalog.file_import_from_disk import sftp_upload_dir
from apps.catalog.models import FileAsset, Product


class Command(BaseCommand):
    help = "Диагностика: файл на диске → FileAsset → товар → GLB на сайте"

    def add_arguments(self, parser):
        parser.add_argument(
            "codes",
            nargs="*",
            help="Коды из имени файла, напр. Кресло4049 (без .glb)",
        )

    def handle(self, *args, **options):
        codes = options["codes"] or ["Кресло4049", "Кресло4050", "Кресло4051", "Кресло4052"]
        incoming = sftp_upload_dir()
        self.stdout.write(f"SFTP incoming: {incoming}\n")

        for code in codes:
            self.stdout.write(self.style.MIGRATE_HEADING(f"=== {code} ==="))
            glb_name = f"{code}.glb"
            on_disk = os.path.join(incoming, glb_name)
            if os.path.isfile(on_disk):
                self.stdout.write(self.style.SUCCESS(f"  Диск incoming: есть ({os.path.getsize(on_disk)} байт)"))
            else:
                self.stdout.write(self.style.ERROR(f"  Диск incoming: НЕТ {glb_name}"))

            asset = FileAsset.objects.filter(asset_id=code, file_type="3d_model").first()
            if asset and asset.file:
                url = (asset.file.url or "")[:120]
                self.stdout.write(self.style.SUCCESS(f"  FileAsset: да → {url}…"))
            else:
                self.stdout.write(self.style.ERROR("  FileAsset: нет — запустите sync_upload3d_models"))

            product = find_product_for_file_asset_id(code)
            if not product:
                self.stdout.write(
                    self.style.ERROR(
                        f"  Товар: НЕ НАЙДЕН по имени «{code}». "
                        "В карточке должны быть title «Кресло 4049» или model_3d_asset_ids/артикул = код файла."
                    )
                )
                continue

            self.stdout.write(
                f"  Товар: id={product.pk} «{product.title}» "
                f"article={product.article!r} model_3d_asset_ids={product.model_3d_asset_ids!r}"
            )
            mg = (product.model_glb or "")[:100]
            self.stdout.write(f"  model_glb: {mg or '(пусто)'}…")

            has_glb = product_matches_catalog_has_glb_q(product)
            on_site = product.catalog_visible_3d
            if has_glb and on_site:
                self.stdout.write(self.style.SUCCESS("  Админка GLB + сайт 3D: OK"))
            elif has_glb and not on_site:
                self.stdout.write(
                    self.style.WARNING("  GLB в данных есть, catalog_visible_3d=False → sync или refresh_catalog_visibility")
                )
            else:
                self.stdout.write(self.style.ERROR("  GLB по правилам каталога: нет (проверьте S3 URL в model_glb)"))

            if product.pk and not Product.objects.filter(pk=product.pk).filter(catalog_has_glb_q()).exists():
                self.stdout.write("  (SQL catalog_has_glb_q не срабатывает — сообщите разработчику)")

        self.stdout.write("")
