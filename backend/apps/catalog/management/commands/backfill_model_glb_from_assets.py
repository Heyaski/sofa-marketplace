"""
Подставить стабильный GLB в поле model_glb из FileAsset (S3) или model_rfa_glb_preview.

1) Заменить протухшие CDN-ссылки (zaohaowu, auth_key=…).
2) Заполнить пустой model_glb, если .glb уже есть в FileAsset по артикулу.
"""

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.catalog.file_urls import is_ephemeral_external_model_url
from apps.catalog.glb_2d_preview import find_stable_glb_url_for_product, products_with_browser_glb_queryset
from apps.catalog.models import Product


class Command(BaseCommand):
    help = (
        "Записать в model_glb стабильный URL из FileAsset .glb или preview; "
        "убрать протухшие внешние CDN."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--verbose", action="store_true")
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        limit = max(0, int(options.get("limit") or 0))
        verbose = options.get("verbose", False)

        updated = 0
        skipped_ok = 0
        no_fileasset = 0

        qs = products_with_browser_glb_queryset().filter(is_active=True).order_by("id")
        if limit:
            qs = qs[: limit * 3]

        seen = 0
        for p in qs.iterator(chunk_size=300):
            if limit and updated >= limit:
                break
            seen += 1
            mg = (p.model_glb or "").strip()
            stable = find_stable_glb_url_for_product(p)

            if not stable:
                no_fileasset += 1
                if verbose:
                    self.stdout.write(
                        self.style.WARNING(
                            f"id={p.pk} article={p.article!r}: нет .glb в FileAsset на S3"
                        )
                    )
                continue

            if mg == stable:
                skipped_ok += 1
                continue

            if verbose or is_ephemeral_external_model_url(mg) or not mg:
                self.stdout.write(
                    f"id={p.pk} article={p.article!r}\n"
                    f"  было: {(mg or '—')[:120]}\n"
                    f"  стало: {stable[:120]}"
                )
            if not dry_run:
                Product.objects.filter(pk=p.pk).update(model_glb=stable)
            updated += 1

        if not dry_run and updated > 0:
            try:
                cache.delete_pattern("products_list*")
            except AttributeError:
                pass

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Обновлено model_glb: {updated}"
                + (" (dry-run)" if dry_run else "")
                + f" | уже ок: {skipped_ok}"
                + f" | нет FileAsset .glb: {no_fileasset}"
                + f" | просмотрено: {seen}"
            )
        )
