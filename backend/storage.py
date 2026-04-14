"""
Кастомный storage backend для S3 с правильной поддержкой path-style addressing
для региональных endpoints Beget.
Оптимизация GLB при сохранении до 10 MB.
"""
import logging
import mimetypes
import os
import subprocess
import tempfile
from pathlib import Path

import requests
from django.conf import settings
from django.core.files.base import ContentFile, File
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GLTFPACK_PATH = PROJECT_ROOT / "scripts" / "bin" / "gltfpack"


def _optimize_glb(content: File) -> File | None:
    """Оптимизирует GLB через gltfpack до целевого размера (по умолчанию 10 MB)."""
    if not GLTFPACK_PATH.exists() or not os.access(GLTFPACK_PATH, os.X_OK):
        logger.warning("gltfpack не найден: %s. Запустите scripts/install-gltfpack-native.sh", GLTFPACK_PATH)
        return None

    content.seek(0)
    data = content.read()
    target_bytes = getattr(settings, "GLB_TARGET_MB", 10) * 1024 * 1024
    if len(data) <= target_bytes:
        return None

    # Итеративно снижаем si до целевого размера. Не ниже 0.08 — сохраняет качество.
    si_values = [0.33, 0.25, 0.2, 0.15, 0.12, 0.1, 0.08]
    if len(data) > 40 * 1024 * 1024:
        si_values = [0.4, 0.33, 0.25, 0.2, 0.15, 0.12, 0.1]

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp_in:
        tmp_in.write(data)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path + ".opt.glb"
    best_result = None
    try:
        for si_ratio in si_values:
            try:
                result = subprocess.run(
                    [str(GLTFPACK_PATH), "-i", tmp_in_path, "-o", tmp_out_path, "-si", str(si_ratio)],
                    capture_output=True,
                    timeout=300,
                    cwd=str(PROJECT_ROOT),
                )
                if result.returncode != 0 or not os.path.exists(tmp_out_path):
                    continue
                with open(tmp_out_path, "rb") as f:
                    optimized = f.read()
                best_result = optimized
                if len(optimized) <= target_bytes:
                    break
            except (subprocess.TimeoutExpired, OSError):
                continue

        if best_result is None:
            logger.warning("gltfpack не сработал для %s", tmp_in_path)
            return None
        return ContentFile(best_result)
    except Exception as e:
        logger.warning("gltfpack исключение: %s", e)
        return None
    finally:
        for p in (tmp_in_path, tmp_out_path):
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass


class BegetS3Storage(S3Boto3Storage):
    """
    Кастомный S3 storage для Beget с правильной поддержкой path-style URLs
    для региональных endpoints
    """
    
    def url(self, name):
        """
        Переопределяем метод url() для правильного формирования path-style URL
        с именем бакета в пути
        """
        # Получаем настройки напрямую из settings
        endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', '')
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        custom_domain_setting = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
        
        # Проверяем, является ли endpoint региональным
        is_regional = False
        if endpoint_url:
            endpoint_domain = endpoint_url.replace('https://', '').replace('http://', '').strip('/')
            is_regional = '.ru' in endpoint_domain or '.storage.beget.cloud' in endpoint_domain
        
        # Если custom domain установлен явно И endpoint не региональный, используем стандартное поведение
        if custom_domain_setting and not is_regional:
            return super().url(name)
        
        # Для региональных endpoints или если custom domain не установлен,
        # используем path-style addressing с именем бакета
        # Формат: https://endpoint/bucket-name/path/to/file
        if endpoint_url and bucket_name:
            # Нормализуем имя файла (убираем начальный слэш, если есть)
            normalized_name = name.lstrip('/')
            
            # Убираем протокол и слэши для чистого домена
            endpoint_domain = endpoint_url.replace('https://', '').replace('http://', '').strip('/')
            
            # Формируем правильный path-style URL
            # НЕ кодируем URL здесь - boto3 и Django REST Framework сделают это автоматически при необходимости
            # Кодирование здесь приводит к двойному кодированию (особенно кириллицы)
            # Используем URL как есть, браузер и HTTP-клиенты правильно обработают специальные символы
            full_url = f"https://{endpoint_domain}/{bucket_name}/{normalized_name}"
            return full_url
        
        # Fallback на стандартное поведение
        return super().url(name)

    @staticmethod
    def _is_sha_mismatch_error(exc: Exception) -> bool:
        text = str(exc or "")
        return (
            "XAmzContentSHA256Mismatch" in text
            or "X-Amz-Content-SHA256" in text
            or "content sha256 mismatch" in text.lower()
        )

    def _save_via_presigned_put(self, name, content):
        """
        Fallback для Beget S3: загружаем через presigned PUT, если обычный PutObject
        падает с XAmzContentSHA256Mismatch.
        """
        if hasattr(content, "seek"):
            content.seek(0)

        content_type = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        params = {
            "Bucket": self.bucket_name,
            "Key": name,
            "ContentType": content_type,
        }
        if self.default_acl:
            params["ACL"] = self.default_acl

        url = self.connection.meta.client.generate_presigned_url(
            "put_object",
            Params=params,
            ExpiresIn=900,
            HttpMethod="PUT",
        )

        headers = {"Content-Type": content_type}
        if self.default_acl:
            headers["x-amz-acl"] = self.default_acl

        size = getattr(content, "size", None)
        if size is not None:
            headers["Content-Length"] = str(size)

        response = requests.put(url, data=content, headers=headers, timeout=900)
        response.raise_for_status()
        return name

    def _save(self, name, content):
        try:
            return super()._save(name, content)
        except Exception as exc:
            if not self._is_sha_mismatch_error(exc):
                raise
            logger.warning(
                "S3 PutObject SHA256 mismatch для '%s'. Переключаемся на presigned PUT fallback.",
                name,
            )
            return self._save_via_presigned_put(name, content)


class GLBOptimizingS3Storage(BegetS3Storage):
    """S3 storage с автоматической оптимизацией GLB при сохранении."""

    def _save(self, name, content):
        optimize = getattr(settings, "GLB_OPTIMIZE_ON_SAVE", True)
        name_lower = name.lower()
        if optimize and (name_lower.endswith(".glb") or name_lower.endswith(".gltf")):
            if hasattr(content, "seek"):
                content.seek(0)
            file_obj = File(content) if not isinstance(content, File) else content
            optimized = _optimize_glb(file_obj)
            if optimized is not None:
                content = optimized
                logger.info("GLB оптимизирован при сохранении: %s", name)
            elif hasattr(content, "seek"):
                content.seek(0)
        return super()._save(name, content)
