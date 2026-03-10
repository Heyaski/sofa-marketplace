#!/usr/bin/env python3
"""
Загрузка оптимизированных GLB в S3 (если USE_S3_STORAGE=1).
Использует boto3 вместо aws cli — корректно обрабатывает кириллические имена файлов.
Запускать ПОСЛЕ optimize-glb.sh
"""
import os
import sys
from pathlib import Path

# Добавляем backend в путь для импорта Django settings (опционально)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ASSETS_DIR = PROJECT_ROOT / "backend" / "media" / "assets"


def load_env():
    """Загружает переменные из .env"""
    for envfile in [PROJECT_ROOT / "backend" / ".env", PROJECT_ROOT / ".env"]:
        if envfile.exists():
            with open(envfile, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        key = key.strip()
                        value = value.strip().strip("'\"")
                        os.environ.setdefault(key, value)
            break


def main():
    load_env()

    if os.environ.get("USE_S3_STORAGE") != "1":
        print("USE_S3_STORAGE не включён. Файлы отдаются с локального диска.")
        print("Оптимизированные файлы уже используются.")
        return 0

    bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME")
    endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "https://s3.beget.com")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")

    if not bucket or not access_key or not secret_key:
        print("Укажите в .env: AWS_STORAGE_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY")
        return 1

    if not ASSETS_DIR.is_dir():
        print(f"Папка не найдена: {ASSETS_DIR}")
        return 1

    try:
        import boto3
        from botocore.config import Config
        from boto3.s3.transfer import TransferConfig
    except ImportError:
        print("Установите boto3: pip install boto3")
        return 1

    # Beget S3 может некорректно обрабатывать multipart — используем PutObject для всех файлов
    transfer_config = TransferConfig(multipart_threshold=200 * 1024 * 1024)  # 200 MB

    # Регион для подписи (Beget)
    region = os.environ.get("AWS_S3_REGION_NAME_FOR_SIGNING")
    if not region and "ru1" in endpoint.lower():
        region = "ru1"
    elif not region:
        region = "us-east-1"

    config = Config(s3={"addressing_style": "path"})
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=config,
    )

    access_mode = os.environ.get("S3_FILE_ACCESS_MODE", "public")
    acl = "private" if access_mode == "signed" else "public-read"

    glb_files = list(ASSETS_DIR.glob("*.glb")) + list(ASSETS_DIR.glob("*.GLB"))
    if not glb_files:
        print("GLB файлы не найдены в", ASSETS_DIR)
        return 0

    print("=== Загрузка оптимизированных GLB в S3 ===")
    print(f"Бакет: {bucket}")
    print(f"Папка: {ASSETS_DIR}")
    print()

    ok = 0
    err = 0
    for fp in glb_files:
        key = f"assets/{fp.name}"
        try:
            client.upload_file(
                str(fp),
                bucket,
                key,
                ExtraArgs={
                    "ContentType": "model/gltf-binary",
                    "ACL": acl,
                },
                Config=transfer_config,
            )
            print(f"  OK: {fp.name}")
            ok += 1
        except Exception as e:
            print(f"  FAIL: {fp.name} — {e}")
            err += 1

    print()
    print(f"Готово. Загружено: {ok}, ошибок: {err}")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
