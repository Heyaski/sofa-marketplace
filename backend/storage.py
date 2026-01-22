"""
Кастомный storage backend для S3 с правильной поддержкой path-style addressing
для региональных endpoints Beget
"""
from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings


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

