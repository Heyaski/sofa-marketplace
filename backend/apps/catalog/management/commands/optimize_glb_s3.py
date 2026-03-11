"""
Оптимизация GLB в S3 по путям из Django (FileAsset).
Скачивает из S3, оптимизирует gltfpack, загружает обратно с тем же ключом.
Использует presigned PUT — обходит XAmzContentSHA256Mismatch в Beget S3.
"""
import urllib.request

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.catalog.models import FileAsset
from storage import _optimize_glb


class Command(BaseCommand):
    help = "Оптимизация GLB в S3 по путям из FileAsset (скачать → gltfpack → загрузить)"

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

        self.stdout.write(f"=== Оптимизация GLB в S3 (по путям из БД) ===")
        self.stdout.write(f"Бакет: {bucket}")
        self.stdout.write(f"Найдено: {len(glb_assets)} файлов\n")

        ok = 0
        err = 0
        skip = 0

        for asset in glb_assets:
            key = asset.file.name
            try:
                resp = client.get_object(Bucket=bucket, Key=key)
                data = resp["Body"].read()

                size_mb = len(data) / (1024 * 1024)
                target_mb = getattr(settings, "GLB_TARGET_MB", 10)
                if size_mb <= target_mb:
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
