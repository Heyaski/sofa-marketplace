from django.core.management.base import BaseCommand

from apps.catalog.glb_2d_preview import (
    load_primary_glb_bytes,
    product_lacks_catalog_2d,
    render_glb_bytes_to_png,
    run_glb_2d_preview_for_product_id,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = (
        "Сгенерировать поле image (2D превью) из GLB/GLTF для товаров без фото. "
        "Файлы GLB не изменяются. "
        "Флаг --check: только проверить какой рендерер работает (без сохранения)."
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
        parser.add_argument(
            "--check",
            action="store_true",
            help=(
                "Тест рендерера: берёт первый попавшийся GLB, рендерит, "
                "показывает какой движок сработал — без сохранения в БД."
            ),
        )

    def handle(self, *args, **options):
        if options["check"]:
            self._run_check()
            return

        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]

        qs = Product.objects.all().order_by("id")
        if pid is not None:
            qs = qs.filter(pk=pid)

        done = 0
        skipped = 0
        errors = 0
        by_renderer: dict[str, int] = {}

        for product in qs.iterator(chunk_size=50):
            if not force and not product_lacks_catalog_2d(product):
                skipped += 1
                continue
            if not load_primary_glb_bytes(product):
                skipped += 1
                continue

            result = run_glb_2d_preview_for_product_id(product.pk, force=force)
            st = result.get("status")
            renderer = result.get("renderer", "?")
            if st == "ok":
                done += 1
                by_renderer[renderer] = by_renderer.get(renderer, 0) + 1
                self.stdout.write(
                    self.style.SUCCESS(f"id={product.pk} [{renderer}]: {result.get('image')}")
                )
                if limit is not None and done >= limit:
                    break
            elif st == "error":
                errors += 1
                self.stdout.write(self.style.ERROR(f"id={product.pk}: {result}"))
            else:
                skipped += 1

        renderer_summary = ", ".join(f"{r}={n}" for r, n in sorted(by_renderer.items()))
        self.stdout.write(
            self.style.NOTICE(
                f"Готово: ok={done} [{renderer_summary}], пропуск/прочее={skipped}, ошибок={errors}"
            )
        )

    def _run_check(self):
        self.stdout.write("=== Проверка рендерера (--check) ===")

        # Найти первый продукт с GLB
        product = None
        glb_bytes = None
        for p in Product.objects.order_by("id").iterator(chunk_size=100):
            b = load_primary_glb_bytes(p)
            if b:
                product = p
                glb_bytes = b
                break

        if not glb_bytes:
            self.stdout.write(self.style.ERROR("Не найдено ни одного продукта с GLB-файлом."))
            return

        self.stdout.write(f"Используем продукт id={product.pk}: {product.title or '—'}")
        self.stdout.write(f"Размер GLB: {len(glb_bytes):,} байт")

        try:
            png, renderer = render_glb_bytes_to_png(glb_bytes)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Рендер упал: {e}"))
            return

        if renderer == "playwright":
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Рендерер: PLAYWRIGHT — PNG {len(png):,} байт. "
                    "Качество как в браузере (текстуры, PBR)."
                )
            )
        elif renderer == "subprocess":
            self.stdout.write(
                self.style.SUCCESS(f"✓ Рендерер: SUBPROCESS (GLB_PREVIEW_COMMAND) — PNG {len(png):,} байт.")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"⚠ Рендерер: MATPLOTLIB — PNG {len(png):,} байт. "
                    "Качество плохое (без UV-текстур). "
                    "Playwright не сработал — проверьте лог выше."
                )
            )

        self.stdout.write("PNG не сохранён в БД (--check только тест).")
