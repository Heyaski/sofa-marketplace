"""
Кастомный storage backend для S3 с правильной поддержкой path-style addressing
для региональных endpoints Beget.
Оптимизация GLB при сохранении (60 MB → ~27 MB).
"""
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile, File
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GLTFPACK_PATH = PROJECT_ROOT / "scripts" / "bin" / "gltfpack"


def _optimize_glb(content: File) -> File | None:
    """Оптимизирует GLB через gltfpack. Возвращает ContentFile с оптимизированным содержимым или None."""
    if not GLTFPACK_PATH.exists() or not os.access(GLTFPACK_PATH, os.X_OK):
        logger.warning("gltfpack не найден: %s. Запустите scripts/install-gltfpack-native.sh", GLTFPACK_PATH)
        return None

    content.seek(0)
    data = content.read()
    if len(data) < 5 * 1024 * 1024:  # < 5 MB — не оптимизируем
        return None

    # 0.2 → ~10–15 MB, загрузка 7–10 сек. 0.33 → ~30 MB, 30 сек.
    si_ratio = str(getattr(settings, "GLB_SI_RATIO", 0.2))
    if len(data) > 40 * 1024 * 1024:  # > 40 MB — меньше упрощение для экономии памяти gltfpack
        si_ratio = str(getattr(settings, "GLB_SI_RATIO_LARGE", 0.25))

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp_in:
        tmp_in.write(data)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path + ".opt.glb"
    try:
        result = subprocess.run(
            [str(GLTFPACK_PATH), "-i", tmp_in_path, "-o", tmp_out_path, "-si", si_ratio],
            capture_output=True,
            timeout=300,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0 or not os.path.exists(tmp_out_path):
            logger.warning("gltfpack ошибка для %s: %s", tmp_in_path, result.stderr.decode(errors="replace"))
            return None

        with open(tmp_out_path, "rb") as f:
            optimized = f.read()
        return ContentFile(optimized)
    except subprocess.TimeoutExpired:
        logger.warning("gltfpack timeout для %s", tmp_in_path)
        return None
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
