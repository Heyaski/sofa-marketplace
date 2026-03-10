#!/usr/bin/env python3
"""
Загрузка оптимизированных GLB в S3 (если USE_S3_STORAGE=1).
Использует presigned PUT URL — обходит XAmzContentSHA256Mismatch в boto3 с Beget S3.
Запускать ПОСЛЕ optimize-glb.sh
"""
import os
import sys
from pathlib import Path

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
        import urllib.request
    except ImportError as e:
        print(f"Требуется boto3: pip install boto3. {e}")
        return 1

    region = os.environ.get("AWS_S3_REGION_NAME_FOR_SIGNING")
    if not region and "ru1" in endpoint.lower():
        region = "ru1"
    elif not region:
        region = "us-east-1"

    config = Config(s3={"addressing_style": "path"}, signature_version="s3v4")
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

    print("=== Загрузка оптимизированных GLB в S3 (presigned PUT) ===")
    print(f"Endpoint: {endpoint}")
    print(f"Бакет: {bucket}")
    print(f"Папка: {ASSETS_DIR}")
    # Проверка: Django должен использовать тот же endpoint (s3.ru1 или s3.beget.com)
    sample = next(ASSETS_DIR.glob("*.glb"), None)
    if sample:
        size_mb = sample.stat().st_size / (1024 * 1024)
        print(f"Пример размера: {sample.name} = {size_mb:.1f} MB (оптимизированный ~20 MB)")
    print()

    ok = 0
    err = 0
    for fp in glb_files:
        key = f"assets/{fp.name}"
        try:
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
            with open(fp, "rb") as f:
                body = f.read()
            req = urllib.request.Request(
                url,
                data=body,
                method="PUT",
                headers={
                    "Content-Type": "model/gltf-binary",
                    "x-amz-acl": acl,
                },
            )
            with urllib.request.urlopen(req) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"HTTP {resp.status}")
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
