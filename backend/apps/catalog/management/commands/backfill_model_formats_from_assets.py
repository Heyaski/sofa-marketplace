"""
Заполнить model_glb / model_rfa / model_ifc URL-ами из FileAsset (S3) по артикулу.

Нужно, если файлы залили через «Импорт файлов» или Excel+ZIP, но папки GLB/RFA/IFC = 0.

  python manage.py backfill_model_formats_from_assets --dry-run
  python manage.py backfill_model_formats_from_assets --category стул
"""
import os

from django.core.management.base import BaseCommand

from apps.catalog.file_urls import should_replace_product_model_url_with_asset
from apps.catalog.models import Product
from apps.catalog.product_model_files import url_has_extension


class Command(BaseCommand):
    help = "Подставить model_glb/rfa/ifc из FileAsset .glb/.rfa/.ifc по артикулу"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--category", type=str, default="", help="Подстрока в названии категории")
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        dry = options["dry_run"]
        cat_needle = (options["category"] or "").strip().lower()
        limit = max(0, int(options["limit"] or 0))

        qs = Product.objects.filter(is_active=True).order_by("id")
        if cat_needle:
            qs = qs.filter(category__name__icontains=cat_needle)

        updated = 0
        seen = 0

        for product in qs.iterator(chunk_size=200):
            if limit and updated >= limit:
                break
            seen += 1
            assets = list(product.get_3d_model_assets())
            if not assets:
                continue

            changes = []
            new_glb = product.model_glb
            new_rfa = product.model_rfa
            new_ifc = product.model_ifc

            for asset in assets:
                if not asset.file or not hasattr(asset.file, "url"):
                    continue
                ext = os.path.splitext(asset.file.name)[1].lower()
                url = asset.file.url
                if ext == ".glb" and should_replace_product_model_url_with_asset(product.model_glb, url):
                    new_glb = url
                    changes.append("glb")
                elif ext == ".rfa" and not (product.model_rfa or "").strip():
                    new_rfa = url
                    changes.append("rfa")
                elif ext == ".ifc" and not (product.model_ifc or "").strip():
                    new_ifc = url
                    changes.append("ifc")
                elif ext == ".ifc" and url_has_extension(product.model_rfa, ".ifc") and not (
                    product.model_ifc or ""
                ).strip():
                    new_ifc = url
                    new_rfa = ""
                    changes.append("ifc←rfa")

            if not changes:
                continue

            if dry:
                self.stdout.write(
                    f"id={product.pk} article={product.article!r} cat={product.category.name!r} "
                    f"→ {','.join(changes)}"
                )
            else:
                Product.objects.filter(pk=product.pk).update(
                    model_glb=new_glb,
                    model_rfa=new_rfa,
                    model_ifc=new_ifc,
                )
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Обновлено: {updated}" + (" (dry-run)" if dry else "") + f", просмотрено: {seen}"
            )
        )
