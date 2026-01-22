"""
Кастомный storage backend для S3 с правильной поддержкой path-style addressing
для региональных endpoints Beget
"""
from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings
from urllib.parse import urljoin, quote


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
        # Если custom domain установлен, используем стандартное поведение
        if self.custom_domain:
            return super().url(name)
        
        # Для path-style addressing нужно явно включить bucket name в URL
        # Формат: https://endpoint/bucket-name/path/to/file
        
        # Получаем endpoint URL и bucket name из настроек
        endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', '')
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        
        if endpoint_url and bucket_name:
            # Нормализуем имя файла (убираем начальный слэш, если есть)
            normalized_name = name.lstrip('/')
            
            # Убираем протокол и слэши для чистого домена
            endpoint_domain = endpoint_url.replace('https://', '').replace('http://', '').strip('/')
            
            # Формируем правильный path-style URL
            # Кодируем путь для правильной обработки специальных символов
            encoded_path = '/'.join(quote(part, safe='') for part in normalized_name.split('/'))
            full_url = f"https://{endpoint_domain}/{bucket_name}/{encoded_path}"
            return full_url
        
        # Fallback на стандартное поведение
        return super().url(name)

