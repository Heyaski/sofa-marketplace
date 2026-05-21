"""Публичные URL для файлов в storage (локально и S3, в т.ч. glb2d_*.png)."""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


def presigned_s3_object_url(object_key: str, *, expires_in: int = 3600) -> str | None:
    """Подписанный URL для приватного S3 (тот же алгоритм, что для FileAsset в API)."""
    key = (object_key or "").strip().lstrip("/")
    if not key:
        return None

    from django.conf import settings

    if getattr(settings, "S3_FILE_ACCESS_MODE", "public") != "signed":
        return None

    endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
    aws_access_key_id = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    aws_secret_access_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    if not all([endpoint_url, aws_access_key_id, aws_secret_access_key, bucket_name]):
        return None

    try:
        import boto3
        from botocore.client import Config

        region_for_signature = getattr(settings, "AWS_S3_REGION_NAME_FOR_SIGNING", None)
        if not region_for_signature:
            low = endpoint_url.lower()
            if "ru1" in low:
                region_for_signature = "ru1"
            else:
                region_match = re.search(r"\.(ru\d+)\.", low)
                region_for_signature = region_match.group(1) if region_match else "us-east-1"

        s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region_for_signature,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
        file_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
        if f"/{bucket_name}/{bucket_name}/" in file_url:
            file_url = file_url.replace(
                f"/{bucket_name}/{bucket_name}/",
                f"/{bucket_name}/",
            )
        return file_url
    except Exception as exc:
        logger.error("presigned_s3_object_url failed for %s: %s", key, exc)
        return None


def resolve_media_field_url(file_field, request=None) -> str | None:
    """
    Абсолютный URL для ImageField/FileField.
    Для приватного S3 — presigned URL (как для GLB), иначе glb2d в 2D каталоге не открываются.
    """
    if not file_field:
        return None
    name = getattr(file_field, "name", None) or ""
    if not str(name).strip():
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
