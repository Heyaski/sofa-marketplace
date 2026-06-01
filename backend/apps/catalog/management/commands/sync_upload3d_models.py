import os

"""
Забрать файлы из каталога SFTP (upload3d) в FileAsset и привязать к товарам —
та же логика, что ZIP в админке /catalog/fileasset/import-files/.

Каталоги (первый существующий + доп. из .env):
  UPLOAD3D_MODELS_INCOMING_DIR=/home/upload3d/models
  UPLOAD3D_MODELS_INCOMING_DIRS=/models   # если Cursor кладёт в chroot /models

Cron (каждые 5–15 мин) или systemd path — см. deploy/cron/README.md
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.catalog.file_import_from_disk import import_directory, resolve_upload3d_incoming_dirs


class Command(BaseCommand):
    help = "Импорт файлов из SFTP upload3d (идентично админке import-files ZIP)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="",
            help="Один каталог (иначе все из UPLOAD3D_MODELS_INCOMING_DIR + DIRS + /models)",
        )
        parser.add_argument("--dry-run", action="store_true", help="Только список файлов, без записи")
        parser.add_argument(
            "--no-move",
            action="store_true",
            help="Не переносить обработанные файлы в imported/",
        )
        parser.add_argument(
            "--optimize-glb",
            action="store_true",
            help="Оптимизировать GLB через gltfpack при загрузке (медленно; по умолчанию выкл.)",
        )

    def handle(self, *args, **options):
        if (options["path"] or "").strip():
            roots = [options["path"].strip()]
        else:
            roots = resolve_upload3d_incoming_dirs()

        dry = options["dry_run"]
        move = not options["no_move"]

        self.stdout.write("Каталоги SFTP для импорта:")
        for r in roots:
            exists = "OK" if os.path.isdir(r) else "НЕТ ПАПКИ"
            self.stdout.write(f"  [{exists}] {r}")

        prev_optimize = settings.GLB_OPTIMIZE_ON_SAVE
        if not options["optimize_glb"]:
            settings.GLB_OPTIMIZE_ON_SAVE = False

        totals = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "products_linked": 0,
            "files_moved": 0,
            "errors": [],
            "linked_product_ids": [],
            "backfill_updated": 0,
            "visibility_refreshed": 0,
            "queued_2d_previews": 0,
            "rfa_glb_queued": 0,
        }

        try:
            for root in roots:
                if not os.path.isdir(root):
                    self.stdout.write(self.style.WARNING(f"Пропуск (нет каталога): {root}"))
                    continue
                self.stdout.write(self.style.MIGRATE_HEADING(f"Импорт: {root}"))
                if dry:
                    self.stdout.write(self.style.WARNING("Режим dry-run"))
                elif not options["optimize_glb"]:
                    self.stdout.write("Оптимизация GLB (gltfpack) отключена для этого прогона.")

                try:
                    stats = import_directory(
                        root,
                        dry_run=dry,
                        move_imported=move,
                        progress=self.stdout.write if not dry else None,
                    )
                except FileNotFoundError as e:
                    self.stdout.write(self.style.ERROR(str(e)))
                    continue

                for key in totals:
                    if key == "errors":
                        totals["errors"].extend(stats.get("errors") or [])
                    elif key == "linked_product_ids":
                        totals["linked_product_ids"].extend(stats.get("linked_product_ids") or [])
                    elif key in stats:
                        totals[key] += stats.get(key) or 0

                if dry:
                    files = stats.get("dry_run_files", [])
                    self.stdout.write(f"  Найдено файлов: {len(files)}")
                    for name, art in files[:20]:
                        self.stdout.write(f"    {name} → {art!r}")
                    if len(files) > 20:
                        self.stdout.write(f"    ... ещё {len(files) - 20}")
        finally:
            settings.GLB_OPTIMIZE_ON_SAVE = prev_optimize

        if dry:
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Итого FileAsset: создано {totals['created']}, обновлено {totals['updated']}, "
                f"пропущено {totals['skipped']}, товаров привязано {totals['products_linked']}, "
                f"в imported/: {totals['files_moved']}"
            )
        )
        if totals["backfill_updated"]:
            self.stdout.write(f"Backfill model_glb/rfa/ifc: {totals['backfill_updated']}")
        if totals["visibility_refreshed"]:
            self.stdout.write(f"Флаги catalog_visible обновлены: {totals['visibility_refreshed']}")
        if totals["queued_2d_previews"]:
            self.stdout.write(f"2D-превью в очереди: {totals['queued_2d_previews']}")
        if totals["rfa_glb_queued"]:
            self.stdout.write(
                self.style.WARNING(
                    f"RFA→GLB в очереди: {totals['rfa_glb_queued']} "
                    "(нужен Celery + RFA_TO_GLB_COMMAND или залейте .glb)"
                )
            )
        if totals["products_linked"] == 0 and totals["created"] + totals["updated"] > 0:
            self.stdout.write(
                self.style.ERROR(
                    "Файлы загружены в FileAsset, но товары не найдены. "
                    "Имя файла = код в карточке (Кресло4052.glb), не только IMR-819300GRY.glb."
                )
            )
        for err in totals["errors"][:30]:
            self.stdout.write(self.style.WARNING(err))
        if len(totals["errors"]) > 30:
            self.stdout.write(f"... ещё ошибок: {len(totals['errors']) - 30}")
