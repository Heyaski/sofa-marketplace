"""
Подставить стабильный GLB в поле model_glb, если там «протухший» внешний URL,
а реальный файл уже есть в FileAsset (.glb) или model_rfa_glb_preview (наш S3).

Запуск после синхронизации или импорта, если в каталоге 403 по zaohaowu/hitem3dstatic.
"""

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.catalog.file_urls import is_ephemeral_external_model_url
from apps.catalog.models import Product


class Command(BaseCommand):
    help = (
        "Заменить model_glb с временным CDN (auth_key и т.п.) на URL из FileAsset .glb "
        "или стабильное model_rfa_glb_preview."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать, что бы изменилось, без записи в БД",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Печатать товары, для которых не нашлось стабильной замены",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Максимум товаров для обхода (0 = без лимита)",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        limit = max(0, int(options.get("limit") or 0))

        qs = Product.objects.exclude(model_glb="").order_by("id")
        if limit:
            qs = qs[:limit]

        updated = 0
        skipped_stable = 0
        no_replacement = 0

        for p in qs.iterator(chunk_size=500):
            mg = (p.model_glb or "").strip()
            if not mg or not is_ephemeral_external_model_url(mg):
                skipped_stable += 1
                continue

            new_url = None
            for asset in p.get_3d_model_assets():
                name = (getattr(asset.file, "name", "") or "").lower()
                if not name.endswith(".glb"):
                    continue
                if asset.file:
                    new_url = (asset.file.url or "").strip()
                    if new_url:
                        break

            if not new_url:
                prev = (p.model_rfa_glb_preview or "").strip()
                if prev and not is_ephemeral_external_model_url(prev):
                    new_url = prev

            if not new_url or new_url == mg:
                no_replacement += 1
                if options.get("verbose"):
                    self.stdout.write(
                        self.style.WARNING(
                            f"id={p.pk} article={p.article!r}: нет стабильного GLB в ассетах/превью"
                        )
                    )
                continue

            self.stdout.write(
                f"id={p.pk} article={p.article!r}\n  было: {mg[:100]}...\n  стало: {new_url[:100]}..."
            )
            if not dry_run:
                Product.objects.filter(pk=p.pk).update(model_glb=new_url)
            updated += 1

        if not dry_run and updated > 0:
            try:
                cache.delete_pattern("products_list*")
            except AttributeError:
                pass

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Обновлено: {updated}"
                + (f" (dry-run)" if dry_run else "")
                + f" | пропущено (уже стабильный): {skipped_stable}"
                + f" | не с чем заменить: {no_replacement}"
            )
        )
