"""
Оптимизация GLB в S3 по путям из Django (FileAsset).
Скачивает из S3, оптимизирует gltfpack, загружает обратно с тем же ключом.
Использует presigned PUT — обходит XAmzContentSHA256Mismatch в Beget S3.
"""
import os
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.catalog.models import FileAsset
from storage import _optimize_glb


class Command(BaseCommand):
    help = "Оптимизация GLB в S3 по путям из FileAsset (скачать → gltfpack → загрузить)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--restore-backup",
            action="store_true",
            help="Брать файлы из backups/glb-assets-original/ вместо S3 (для восстановления качества)",
        )
        parser.add_argument(
            "--list-backup",
            action="store_true",
            help="Показать файлы в бэкапе и маппинг на FileAsset",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "USE_S3_STORAGE", False):
            self.stdout.write(self.style.WARNING("USE_S3_STORAGE не включён. Используйте optimize-glb.sh для локальных файлов."))
            return

        assets = FileAsset.objects.filter(file_type="3d_model").exclude(file="")
        glb_assets = [a for a in assets if a.file.name and a.file.name.lower().endswith((".glb", ".gltf"))]

        if not glb_assets:
            self.stdout.write("GLB/GLTF файлы не найдены в FileAsset.")
            return

        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            self.stdout.write(self.style.ERROR("Требуется boto3: pip install boto3"))
            return

        endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "")
        region = getattr(settings, "AWS_S3_REGION_NAME_FOR_SIGNING", None) or (
            "ru1" if "ru1" in endpoint.lower() else "us-east-1"
        )
        config = Config(s3={"addressing_style": "path"}, signature_version="s3v4")
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=region,
            config=config,
        )

        bucket = settings.AWS_STORAGE_BUCKET_NAME
        acl = "private" if getattr(settings, "S3_FILE_ACCESS_MODE", "public") == "signed" else "public-read"
        restore_backup = options.get("restore_backup", False)
        list_backup = options.get("list_backup", False)

        backup_dirs = [
            Path(settings.BASE_DIR).parent / "backups" / "glb-assets-original",
            Path(settings.BASE_DIR) / "media" / "assets-backup",
            Path(settings.BASE_DIR) / "media" / "assets",
        ]
        backup_dir = next((d for d in backup_dirs if d.is_dir()), backup_dirs[0])
        if not backup_dir.is_dir():
            self.stdout.write(self.style.WARNING(f"Папка бэкапа: {backup_dir}"))
            if restore_backup or list_backup:
                self.stdout.write(self.style.ERROR("Ни одна папка бэкапа не найдена. Проверьте: backups/glb-assets-original, media/assets-backup, media/assets"))
                return
        existing_backups = [d for d in backup_dirs if d.is_dir()]
        if list_backup or restore_backup:
            for d in existing_backups:
                self.stdout.write(f"  Папка бэкапа: {d}")
        if list_backup:
            by_name = {}
            for d in existing_backups:
                for p in d.glob("*.glb"):
                    by_name.setdefault(p.name, p)
                for p in d.glob("*.GLB"):
                    by_name.setdefault(p.name, p)
            backup_files = sorted(by_name.values(), key=lambda p: p.name)
            self.stdout.write(f"Файлов в бэкапе: {len(backup_files)}")
            for bf in backup_files[:20]:
                self.stdout.write(f"  {bf.name}")
            if len(backup_files) > 20:
                self.stdout.write(f"  ... и ещё {len(backup_files) - 20}")
            self.stdout.write("")
            for asset in glb_assets[:10]:
                bn = os.path.basename(asset.file.name)
                base_short = bn.rsplit("_", 1)[0] + ".glb" if "_" in bn and bn.lower().endswith((".glb", ".gltf")) else bn
                found = any((d / bn).is_file() or (d / base_short).is_file() for d in existing_backups)
                self.stdout.write(f"  {bn} -> {'✓' if found else '✗'} (ищем {base_short})")
            return

        self.stdout.write(f"=== Оптимизация GLB в S3 (по путям из БД) ===")
        if restore_backup:
            self.stdout.write(f"Источники: {', '.join(str(d) for d in existing_backups)}")
        self.stdout.write(f"Бакет: {bucket}")
        self.stdout.write(f"Найдено: {len(glb_assets)} файлов\n")

        ok = 0
        err = 0
        skip = 0

        for asset in glb_assets:
            key = asset.file.name
            try:
                if restore_backup:
                    basename = os.path.basename(key)
                    backup_path = None
                    for bdir in backup_dirs:
                        if not bdir.is_dir():
                            continue
                        p = bdir / basename
                        if p.is_file():
                            backup_path = p
                            break
                    if not backup_path:
                        base_short = basename.rsplit("_", 1)[0] + basename[basename.rfind("."):] if "_" in basename and basename.lower().endswith((".glb", ".gltf")) else basename
                        for bdir in backup_dirs:
                            if not bdir.is_dir():
                                continue
                            for candidate in [
                                bdir / base_short,
                                bdir / basename,
                                bdir / f"{asset.asset_id}.glb",
                                bdir / f"{asset.asset_id}.GLB",
                            ]:
                                if candidate.is_file():
                                    backup_path = candidate
                                    break
                            if backup_path:
                                break
                            stem = base_short.replace(".glb", "").replace(".GLB", "")
                            candidates = list(bdir.glob(f"{stem}*.glb")) + list(bdir.glob(f"{stem}*.GLB"))
                            if len(candidates) == 1:
                                backup_path = candidates[0]
                                break
                        if not backup_path or not backup_path.is_file():
                            self.stdout.write(self.style.WARNING(f"  SKIP: {key} — нет в бэкапе"))
                            skip += 1
                            continue
                    with open(backup_path, "rb") as f:
                        data = f.read()
                else:
                    resp = client.get_object(Bucket=bucket, Key=key)
                    data = resp["Body"].read()

                size_mb = len(data) / (1024 * 1024)
                target_mb = getattr(settings, "GLB_TARGET_MB", 20)
                if not restore_backup and size_mb <= target_mb:
                    self.stdout.write(f"  SKIP: {key} ({size_mb:.1f} MB, уже ≤ {target_mb} MB)")
                    skip += 1
                    continue

                optimized = _optimize_glb(ContentFile(data))
                if optimized is None:
                    self.stdout.write(self.style.ERROR(f"  FAIL: {key} — gltfpack не сработал"))
                    err += 1
                    continue

                opt_data = optimized.read()
                opt_mb = len(opt_data) / (1024 * 1024)

                # Presigned PUT обходит XAmzContentSHA256Mismatch в Beget S3
                url = client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": bucket,
                        "Key": key,
                        "ContentType": "model/gltf-binary",
                        "ACL": acl,
                    },
                    ExpiresIn=3600,
                )
                req = urllib.request.Request(
                    url,
                    data=opt_data,
                    method="PUT",
                    headers={
                        "Content-Type": "model/gltf-binary",
                        "x-amz-acl": acl,
                    },
                )
                with urllib.request.urlopen(req) as resp:
                    if resp.status >= 400:
                        raise RuntimeError(f"HTTP {resp.status}")

                self.stdout.write(f"  OK: {key} ({size_mb:.1f} → {opt_mb:.1f} MB)")
                ok += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  FAIL: {key} — {e}"))
                err += 1

        self.stdout.write(f"\nГотово. Оптимизировано: {ok}, пропущено: {skip}, ошибок: {err}")
