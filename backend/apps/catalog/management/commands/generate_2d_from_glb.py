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
import time

import django
from django.core.management.base import BaseCommand


def _uses_sqlite() -> bool:
    from django.conf import settings

    engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
    return "sqlite" in engine


def _allow_sync_orm_with_playwright() -> None:
    """
    Playwright sync_api поднимает event loop; Django 5+ иначе блокирует ORM
    (SynchronousOnlyOperation). Разрешено только в management command.
    """
    os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"
    from django.db import close_old_connections

    close_old_connections()


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
        parser.add_argument(
            "--matplotlib",
            action="store_true",
            help="Без Playwright/Chromium — только matplotlib (быстрее на сервере без браузера)",
        )

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
        from apps.catalog.glb_2d_preview import (
            PlaywrightSession,
            collect_catalog_2d_stats,
            product_has_glb_source,
            product_lacks_catalog_2d,
            products_with_browser_glb_queryset,
        )
        from apps.catalog.management.commands.generate_2d_worker import render_one
        from apps.catalog.models import Product

        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]
        use_matplotlib = options.get("matplotlib", False)

        if _uses_sqlite():
            self.stdout.write(
                self.style.WARNING(
                    "SQLite: на время прогона остановите сайт (gunicorn/uwsgi/celery), "
                    "иначе возможна ошибка «database is locked»."
                )
            )

        stats = collect_catalog_2d_stats()
        self.stdout.write(
            f"Каталог: активных {stats['total_active']}, с фото 2D {stats['with_2d_image']}, "
            f"ждут PNG {stats['needs_png_from_glb']}, GLB в БД но файл недоступен "
            f"{stats.get('glb_sql_not_loadable', 0)}, без GLB {stats['no_glb_no_2d']}"
        )

        product_ids = self._collect_ids(pid, force)
        total = len(product_ids)
        self.stdout.write(f"Товаров для обработки в этом прогоне: {total}")
        if total == 0:
            self.stdout.write(
                self.style.WARNING(
                    "Очередь пуста. Сначала: python manage.py backfill_model_glb_from_assets --verbose\n"
                    "Если «нет FileAsset» — загрузите .glb и синхронизируйте FileAsset с товарами."
                )
            )
            return

        done = 0
        errors = 0
        by_renderer: dict[str, int] = {}

        from django.conf import settings as dj_settings
        use_pw = not use_matplotlib and getattr(dj_settings, "GLB_2D_USE_PLAYWRIGHT", True)

        session = None
        if use_pw:
            _allow_sync_orm_with_playwright()
            self.stdout.write(
                "Запуск Chromium (Playwright)… первый старт может занять 1–2 мин.",
                ending="\n",
            )
            self.stdout.flush()
            try:
                session = PlaywrightSession().__enter__()
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(
                        f"PlaywrightSession не запустилась: {e} — используем matplotlib"
                    )
                )
                session = None
        else:
            self.stdout.write("Рендер: matplotlib (без браузера).")

        try:
            for product_id in product_ids:
                if limit is not None and done >= limit:
                    break
                result = render_one(product_id, force=force, session=session)
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
        if limit is not None and done < total:
            remaining = total - done
            self.stdout.write(
                self.style.WARNING(
                    f"Остановлено по --limit {limit}: в очереди ещё ~{remaining} товаров. "
                    f"Запустите снова: python manage.py generate_2d_from_glb"
                )
            )

    # ------------------------------------------------------------------ #
    # Многопроцессный прогон                                              #
    # ------------------------------------------------------------------ #

    def _run_parallel(self, options, workers: int):
        from apps.catalog.management.commands.generate_2d_worker import worker_process

        pid = options["product_id"]
        limit = options["limit"]
        force = options["force"]

        product_ids = self._collect_ids(pid, force)
        if limit is not None:
            product_ids = product_ids[:limit]
        total = len(product_ids)
        self.stdout.write(f"Товаров: {total}, воркеров: {workers}")
        if total == 0:
            self.stdout.write(
                self.style.WARNING(
                    "Очередь пуста. Сначала: python manage.py backfill_model_glb_from_assets --verbose"
                )
            )
            return

        chunks = [product_ids[i::workers] for i in range(workers)]

        ctx = multiprocessing.get_context("spawn")
        procs = []
        queues = []
        for chunk in chunks:
            q = ctx.Queue()
            queues.append(q)
            p = ctx.Process(target=worker_process, args=(chunk, force, q), daemon=True)
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
            time.sleep(0.1)

        for p in procs:
            p.join(timeout=10)

        renderer_summary = ", ".join(f"{r}={n}" for r, n in sorted(by_renderer.items()))
        self.stdout.write(
            self.style.NOTICE(
                f"Готово: ok={done} [{renderer_summary}], ошибок={errors}, всего={total}"
            )
        )

    def _collect_ids(self, pid, force) -> list[int]:
        from apps.catalog.glb_2d_preview import (
            product_has_glb_source,
            product_lacks_catalog_2d,
            products_with_browser_glb_queryset,
        )
        from apps.catalog.models import Product

        if pid is not None:
            product = (
                Product.objects.filter(pk=pid).prefetch_related("images").first()
            )
            if not product:
                self.stdout.write(self.style.ERROR(f"Товар id={pid} не найден в БД."))
                return []
            if not product_has_glb_source(product):
                self.stdout.write(
                    self.style.ERROR(
                        f"Товар id={pid} («{product.title or '—'}»): нет GLB/GLTF "
                        f"(проверьте model_glb, model_rfa_glb_preview, FileAsset .glb)."
                    )
                )
                self._hint_products_with_glb()
                return []
            if not force and not product_lacks_catalog_2d(product):
                self.stdout.write(
                    self.style.WARNING(
                        f"Товар id={pid} уже с фото 2D. Добавьте --force для перегенерации."
                    )
                )
                return []
            self.stdout.write(f"Товар id={pid}: GLB найден, будет обработан.")
            return [pid]

        self.stdout.write("Сканируем каталог (только БД, без загрузки GLB с S3)…")

        qs = products_with_browser_glb_queryset().order_by("id")
        ids: list[int] = []
        scanned = 0
        for product in qs.prefetch_related("images").iterator(chunk_size=200):
            scanned += 1
            if scanned % 50 == 0:
                self.stdout.write(f"  …проверено {scanned}, отобрано {len(ids)}")
            if not force and not product_lacks_catalog_2d(product):
                continue
            if not product_has_glb_source(product):
                continue
            ids.append(product.pk)

        self.stdout.write(f"  Проверено {scanned}, с GLB для рендера: {len(ids)}.")
        if len(ids) == 0:
            self._hint_products_with_glb()
        return ids

    def _hint_products_with_glb(self) -> None:
        sample = list(
            products_with_browser_glb_queryset()
            .order_by("id")
            .values_list("id", "title")[:5]
        )
        if sample:
            self.stdout.write("Примеры id с GLB в каталоге:")
            for pk, title in sample:
                self.stdout.write(f"  --product-id {pk}  ({title or '—'})")
        else:
            self.stdout.write(
                "В БД нет товаров с GLB. Загрузите .glb в FileAsset или заполните model_glb."
            )

    # ------------------------------------------------------------------ #
    # --check                                                             #
    # ------------------------------------------------------------------ #

    def _run_check(self):
        from apps.catalog.glb_2d_preview import (
            load_primary_glb_bytes,
            product_has_glb_source,
            products_with_browser_glb_queryset,
            render_glb_bytes_to_png,
        )

        self.stdout.write("=== Проверка рендерера (--check) ===")
        product = None
        glb_bytes = None
        for p in products_with_browser_glb_queryset().order_by("id").iterator(chunk_size=50):
            if not product_has_glb_source(p):
                continue
            self.stdout.write(f"Загрузка GLB для id={p.pk}…")
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
