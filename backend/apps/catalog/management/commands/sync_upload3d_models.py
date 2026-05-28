"""
Забрать файлы из каталога SFTP (upload3d) в FileAsset и привязать к товарам —
как «Массовый импорт файлов» в админке, без ZIP.

По умолчанию: /home/upload3d/models (env UPLOAD3D_MODELS_INCOMING_DIR).

После успешной привязки файлы переносятся в подпапку imported/.

Cron (каждые 5–15 мин):
  */10 * * * * cd .../backend && venv/bin/python manage.py sync_upload3d_models >> logs/upload3d_sync.log 2>&1
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.catalog.file_import_from_disk import default_incoming_dir, import_directory


class Command(BaseCommand):
    help = "Импорт файлов из каталога SFTP upload3d (как admin import-files ZIP)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="",
            help="Каталог с файлами (по умолчанию UPLOAD3D_MODELS_INCOMING_DIR)",
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
        root = (options["path"] or "").strip() or default_incoming_dir()
        dry = options["dry_run"]
        move = not options["no_move"]

        self.stdout.write(f"Каталог: {root}")
        if dry:
            self.stdout.write(self.style.WARNING("Режим dry-run"))
        elif not options["optimize_glb"]:
            self.stdout.write("Оптимизация GLB (gltfpack) отключена для этого прогона.")

        prev_optimize = settings.GLB_OPTIMIZE_ON_SAVE
        if not options["optimize_glb"]:
            settings.GLB_OPTIMIZE_ON_SAVE = False

        try:
            stats = import_directory(
                root,
                dry_run=dry,
                move_imported=move,
                progress=self.stdout.write if not dry else None,
            )
        except FileNotFoundError as e:
            self.stdout.write(self.style.ERROR(str(e)))
            return
        finally:
            settings.GLB_OPTIMIZE_ON_SAVE = prev_optimize

        if dry:
            files = stats.get("dry_run_files", [])
            self.stdout.write(f"Найдено подходящих файлов: {len(files)}")
            for name, art in files[:40]:
                self.stdout.write(f"  {name} → артикул {art!r}")
            if len(files) > 40:
                self.stdout.write(f"  ... ещё {len(files) - 40}")
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Создано FileAsset: {stats['created']}, обновлено: {stats['updated']}, "
                f"пропущено: {stats['skipped']}, товаров привязано: {stats['products_linked']}, "
                f"файлов в imported/: {stats['files_moved']}"
            )
        )
        for err in stats["errors"][:30]:
            self.stdout.write(self.style.WARNING(err))
        if len(stats["errors"]) > 30:
            self.stdout.write(f"... ещё ошибок: {len(stats['errors']) - 30}")
