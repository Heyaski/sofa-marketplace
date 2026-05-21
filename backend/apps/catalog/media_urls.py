"""Публичные URL для файлов в storage (локально и S3, в т.ч. glb2d_*.png)."""
from __future__ import annotations

import logging
import re
import threading
import time

logger = logging.getLogger(__name__)

_s3_client = None
_s3_client_lock = threading.Lock()
_PRESIGN_CACHE: dict[str, tuple[str, float]] = {}
_PRESIGN_CACHE_LOCK = threading.Lock()
_PRESIGN_CACHE_TTL = 3000  # секунд — меньше срока жизни presigned URL


def _get_s3_client():
    """Один клиент на процесс — иначе list каталога создаёт сотни клиентов и висит."""
    global _s3_client
    if _s3_client is not None:
        return _s3_client
    with _s3_client_lock:
        if _s3_client is not None:
            return _s3_client
        from django.conf import settings
        import boto3
        from botocore.client import Config

        endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        aws_access_key_id = getattr(settings, "AWS_ACCESS_KEY_ID", None)
        aws_secret_access_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
        if not all([endpoint_url, aws_access_key_id, aws_secret_access_key]):
            return None

        region_for_signature = getattr(settings, "AWS_S3_REGION_NAME_FOR_SIGNING", None)
        if not region_for_signature:
            low = endpoint_url.lower()
            if "ru1" in low:
                region_for_signature = "ru1"
            else:
                region_match = re.search(r"\.(ru\d+)\.", low)
                region_for_signature = region_match.group(1) if region_match else "us-east-1"

        _s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region_for_signature,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=3,
                read_timeout=5,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )
        return _s3_client


def public_storage_object_url(object_key: str) -> str | None:
    """Прямой URL без подписи (custom domain или path-style endpoint)."""
    key = (object_key or "").strip().lstrip("/")
    if not key:
        return None
    from django.conf import settings

    custom = getattr(settings, "AWS_S3_CUSTOM_DOMAIN", None)
    if custom:
        domain = str(custom).replace("https://", "").replace("http://", "").strip("/")
        return f"https://{domain}/{key}"
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    if endpoint and bucket:
        base = str(endpoint).rstrip("/")
        return f"{base}/{bucket}/{key}"
    return None


def presigned_s3_object_url(object_key: str, *, expires_in: int = 3600) -> str | None:
    """Подписанный URL для приватного S3 (кэш + один boto3-клиент)."""
    key = (object_key or "").strip().lstrip("/")
    if not key:
        return None

    from django.conf import settings

    if getattr(settings, "S3_FILE_ACCESS_MODE", "public") != "signed":
        return public_storage_object_url(key)

    now = time.time()
    with _PRESIGN_CACHE_LOCK:
        cached = _PRESIGN_CACHE.get(key)
        if cached and cached[1] > now:
            return cached[0]

    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    if not bucket_name:
        return public_storage_object_url(key)

    client = _get_s3_client()
    if client is None:
        return public_storage_object_url(key)

    try:
        file_url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
        if f"/{bucket_name}/{bucket_name}/" in file_url:
            file_url = file_url.replace(
                f"/{bucket_name}/{bucket_name}/",
                f"/{bucket_name}/",
            )
        with _PRESIGN_CACHE_LOCK:
            _PRESIGN_CACHE[key] = (file_url, now + min(expires_in - 60, _PRESIGN_CACHE_TTL))
        return file_url
    except Exception as exc:
        logger.warning("presigned_s3_object_url failed for %s: %s", key, exc)
        return public_storage_object_url(key)


def resolve_media_field_url(file_field, request=None) -> str | None:
    """
    Абсолютный URL для ImageField/FileField.
    Для приватного S3 — presigned URL (кэш), иначе storage.url.
    """
    if not file_field:
        return None
    name = getattr(file_field, "name", None) or ""
    if not str(name).strip():
        return None

    # Список каталога: без пачки presign на каждую карточку (иначе таймаут 90s на /api/products/).
    if request is not None and getattr(request, "_catalog_list_fast_urls", False):
        direct = public_storage_object_url(name)
        if direct:
            if str(direct).startswith(("http://", "https://")):
                return direct
            if hasattr(request, "build_absolute_uri"):
                return request.build_absolute_uri(direct)
            return direct
        # На list не дергаем storage.url / presign — иначе 20× S3 на страницу и timeout.
        return None

    from django.conf import settings

    use_signed = getattr(settings, "S3_FILE_ACCESS_MODE", "public") == "signed"
    image_url: str | None = None

    if use_signed:
        image_url = presigned_s3_object_url(name)

    if not image_url:
        try:
            if hasattr(file_field, "storage") and hasattr(file_field.storage, "url"):
                image_url = file_field.storage.url(name)
            elif hasattr(file_field, "url"):
                image_url = file_field.url
        except Exception:
            return None

    if not image_url:
        return None
    if str(image_url).startswith(("http://", "https://")):
        return image_url
    if request is not None:
        return request.build_absolute_uri(image_url)
    return image_url
