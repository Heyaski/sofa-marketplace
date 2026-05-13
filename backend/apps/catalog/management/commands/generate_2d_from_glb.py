"""
Генерация 2D-превью (PNG) из GLB для всех товаров без фото.

Оптимизации:
- Один Chromium-браузер на весь прогон (не перезапускается для каждого товара).
- wait_for_function: ждём реальную загрузку GLB, а не фиксированные секунды.
- --workers N: N параллельных процессов (каждый со своим браузером).
- Новые товары с GLB генерируются автоматически через Celery (см. signals.py).
"""
import multiprocessing
import os

import django
from django.core.management.base import BaseCommand

from apps.catalog.glb_2d_preview import (
    load_primary_glb_bytes,
    product_lacks_catalog_2d,
    render_glb_bytes_to_png,
    run_glb_2d_preview_for_product_id,
    PlaywrightSession,
)
from apps.catalog.models import Product


class Command(BaseCommand):
    help = (
        "Сгенерировать поле image (2D превью) из GLB/GLTF. "
        "--check: проверить рендерер без сохранения. "
        "--workers N: параллельный рендер в N процессах."
    )

    def add_arguments(self, parser):
        parser.add_argument("--product-id", type=int, default=None)
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--force", action="store_true",
                            help="Перегенерировать даже если уже есть фото")
        parser.add_argument("--check", action="store_true",
                            help="Тест рендерера (без сохранения в БД)")
        parser.add_argument("--workers", type=int, default=1,
                            help="Кол-во параллельных процессов (по умолчанию 1)")

    def handle(self, *args, **options):
        if options["check"]:
            self._run_check()
            return

        workers = max(1, options["workers"])
        if workers == 1:
            self._run_single(options)
        else:
            self._run_parallel(options, workers)

    # ------------------------------------------------------------------ #
    # Однопроцессный прогон с переиспользованием браузера                 #
    # ------------------------------------------------------------------ #

    def _run_single(self, options):
        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]

        product_ids = self._collect_ids(pid, force)
        total = len(product_ids)
        self.stdout.write(f"Товаров для обработки: {total}")

        done = 0
        errors = 0
        by_renderer: dict[str, int] = {}

        from django.conf import settings as dj_settings
        use_pw = getattr(dj_settings, "GLB_2D_USE_PLAYWRIGHT", True)

        try:
            session = PlaywrightSession().__enter__() if use_pw else None
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"PlaywrightSession не запустилась: {e} — используем matplotlib"))
            session = None

        try:
            for product_id in product_ids:
                if limit is not None and done >= limit:
                    break
                result = _render_one(product_id, force=force, session=session)
                st = result.get("status")
                renderer = result.get("renderer", "?")
                if st == "ok":
                    done += 1
                    by_renderer[renderer] = by_renderer.get(renderer, 0) + 1
                    self.stdout.write(
                        self.style.SUCCESS(f"[{done}/{total}] id={product_id} [{renderer}]")
                    )
                elif st == "error":
                    errors += 1
                    self.stdout.write(self.style.ERROR(f"id={product_id}: {result}"))
                # skipped — тихо
        finally:
            if session:
                session.__exit__(None, None, None)

        renderer_summary = ", ".join(f"{r}={n}" for r, n in sorted(by_renderer.items()))
        self.stdout.write(
            self.style.NOTICE(
                f"Готово: ok={done} [{renderer_summary}], ошибок={errors}, всего={total}"
            )
        )

    # ------------------------------------------------------------------ #
    # Многопроцессный прогон                                              #
    # ------------------------------------------------------------------ #

    def _run_parallel(self, options, workers: int):
        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]

        product_ids = self._collect_ids(pid, force)
        if limit is not None:
            product_ids = product_ids[:limit]
        total = len(product_ids)
        self.stdout.write(f"Товаров: {total}, воркеров: {workers}")

        # Делим на чанки
        chunks = [product_ids[i::workers] for i in range(workers)]

        ctx = multiprocessing.get_context("spawn")
        procs = []
        queues = []
        for chunk in chunks:
            q = ctx.Queue()
            queues.append(q)
            p = ctx.Process(target=_worker_process, args=(chunk, force, q), daemon=True)
            p.start()
            procs.append(p)

        done = 0
        errors = 0
        by_renderer: dict[str, int] = {}

        # Собираем результаты
        finished = [False] * workers
        while not all(finished):
            for i, (proc, q) in enumerate(zip(procs, queues)):
                if finished[i]:
                    continue
                while not q.empty():
                    msg = q.get_nowait()
                    if msg is None:
                        finished[i] = True
                        break
                    product_id, st, renderer = msg
                    if st == "ok":
                        done += 1
                        by_renderer[renderer] = by_renderer.get(renderer, 0) + 1
                        self.stdout.write(
                            self.style.SUCCESS(f"[{done}/{total}] id={product_id} [{renderer}]")
                        )
                    elif st == "error":
                        errors += 1
                        self.stdout.write(self.style.ERROR(f"id={product_id}: error"))
                if not finished[i] and not proc.is_alive():
                    finished[i] = True
            import time; time.sleep(0.1)

        for p in procs:
            p.join(timeout=10)

        renderer_summary = ", ".join(f"{r}={n}" for r, n in sorted(by_renderer.items()))
        self.stdout.write(
            self.style.NOTICE(
                f"Готово: ok={done} [{renderer_summary}], ошибок={errors}, всего={total}"
            )
        )

    def _collect_ids(self, pid, force) -> list[int]:
        qs = Product.objects.order_by("id")
        if pid is not None:
            qs = qs.filter(pk=pid)
        ids = []
        for product in qs.only("id", "image", "photo_url").iterator(chunk_size=500):
            if not force and not product_lacks_catalog_2d(product):
                continue
            if not load_primary_glb_bytes(product):
                continue
            ids.append(product.pk)
        return ids

    # ------------------------------------------------------------------ #
    # --check                                                             #
    # ------------------------------------------------------------------ #

    def _run_check(self):
        self.stdout.write("=== Проверка рендерера (--check) ===")
        product = None
        glb_bytes = None
        for p in Product.objects.order_by("id").iterator(chunk_size=100):
            b = load_primary_glb_bytes(p)
            if b:
                product = p
                glb_bytes = b
                break
        if not glb_bytes:
            self.stdout.write(self.style.ERROR("Нет продуктов с GLB."))
            return
        self.stdout.write(f"Продукт id={product.pk}: {product.title or '—'}")
        self.stdout.write(f"Размер GLB: {len(glb_bytes):,} байт")
        try:
            png, renderer = render_glb_bytes_to_png(glb_bytes)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Рендер упал: {e}"))
            return
        if renderer == "playwright":
            self.stdout.write(self.style.SUCCESS(
                f"✓ PLAYWRIGHT — PNG {len(png):,} байт. Качество как в браузере."
            ))
        elif renderer == "subprocess":
            self.stdout.write(self.style.SUCCESS(
                f"✓ SUBPROCESS — PNG {len(png):,} байт."
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f"⚠ MATPLOTLIB — PNG {len(png):,} байт. Без UV-текстур. "
                "Playwright не сработал — см. лог выше."
            ))
        self.stdout.write("PNG не сохранён в БД.")


# ------------------------------------------------------------------ #
# Вспомогательные функции для multiprocessing (должны быть на уровне  #
# модуля чтобы pickle работал с spawn)                                #
# ------------------------------------------------------------------ #

def _render_one(product_id: int, force: bool, session) -> dict:
    """Рендер одного продукта. session=PlaywrightSession или None."""
    from apps.catalog.glb_2d_preview import (
        load_primary_glb_bytes,
        render_glb_bytes_to_png,
        _infer_load_file_type,
        _invalidate_product_cache,
    )
    from apps.catalog.models import Product
    from django.core.files.base import ContentFile

    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return {"status": "error", "reason": "no-product"}
    raw = load_primary_glb_bytes(product)
    if not raw:
        return {"status": "skipped", "reason": "no-glb"}

    try:
        if session is not None:
            ext = _infer_load_file_type(raw)
            png = session.render(raw, ext)
            renderer = "playwright"
        else:
            png, renderer = render_glb_bytes_to_png(raw)
    except Exception as e:
        return {"status": "error", "reason": str(e)[:300]}

    name = f"glb2d_{product_id}.png"
    product.image.save(name, ContentFile(png), save=True)
    _invalidate_product_cache(product_id)
    return {"status": "ok", "renderer": renderer}


def _worker_process(product_ids: list, force: bool, result_queue):
    """Дочерний процесс: инициализирует Django, запускает PlaywrightSession."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    from django.conf import settings as dj_settings
    from apps.catalog.glb_2d_preview import PlaywrightSession

    use_pw = getattr(dj_settings, "GLB_2D_USE_PLAYWRIGHT", True)
    try:
        session = PlaywrightSession().__enter__() if use_pw else None
    except Exception:
        session = None

    try:
        for product_id in product_ids:
            result = _render_one(product_id, force=force, session=session)
            st = result.get("status", "error")
            renderer = result.get("renderer", "?")
            result_queue.put((product_id, st, renderer))
    finally:
        if session:
            session.__exit__(None, None, None)
        result_queue.put(None)  # сигнал завершения
