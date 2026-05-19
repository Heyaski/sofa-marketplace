from rest_framework import serializers
from .models import Product, Category, ProductImage, FileAsset
from .file_urls import is_ephemeral_external_model_url, url_looks_like_browser_model_file
import os


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    parent_category = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = "__all__"

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            image_url = obj.image.url
            # Если URL уже полный (начинается с http:// или https://), возвращаем как есть
            if image_url.startswith(('http://', 'https://')):
                return image_url
            return request.build_absolute_uri(image_url) if request else image_url
        return None
    
    def get_parent_category(self, obj):
        """Возвращает информацию о родительской категории, если она есть"""
        if obj.parent:
            return {
                'id': obj.parent.id,
                'name': obj.parent.name,
                'slug': obj.parent.slug,
            }
        return None


class ProductImageSerializer(serializers.ModelSerializer):
    """Сериализатор для изображений товара"""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image_url', 'order']

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            # Проверяем режим доступа к файлам
            from django.conf import settings
            use_signed_urls = getattr(settings, 'S3_FILE_ACCESS_MODE', 'public') == 'signed'
            
            if use_signed_urls and hasattr(obj.image, 'storage'):
                try:
                    storage = obj.image.storage
                    image_url = storage.url(obj.image.name)
                    return image_url
                except Exception:
                    image_url = obj.image.url
            else:
                image_url = obj.image.url
            
            # Если URL уже полный (начинается с http:// или https://), возвращаем как есть
            if image_url.startswith(('http://', 'https://')):
                return image_url
            return request.build_absolute_uri(image_url) if request else image_url
        return None


class FileAssetSerializer(serializers.ModelSerializer):
    """Сериализатор для файловых ресурсов"""
    file_url = serializers.SerializerMethodField()
    file_ext = serializers.SerializerMethodField()
    
    class Meta:
        model = FileAsset
        fields = ['asset_id', 'file_type', 'file_url', 'file_ext', 'description']
    
    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            # Проверяем режим доступа к файлам
            from django.conf import settings
            use_signed_urls = getattr(settings, 'S3_FILE_ACCESS_MODE', 'public') == 'signed'
            
            if use_signed_urls:
                # Генерируем подписанный URL для приватных файлов через boto3 напрямую
                # Это гарантирует правильный формат URL без дублирования пути
                try:
                    import boto3
                    from django.conf import settings
                    from botocore.client import Config
                    
                    endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
                    aws_access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
                    aws_secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
                    bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
                    
                    if not all([endpoint_url, aws_access_key_id, aws_secret_access_key, bucket_name]):
                        raise ValueError("Не все настройки S3 указаны для генерации подписанного URL")
                    
                    # Создаем клиент с правильной конфигурацией для path-style URL
                    # Path-style формат: https://endpoint/bucket/path/to/file
                    # Это избегает проблем с дублированием пути
                    # Важно: для Beget S3 нужно определить регион из endpoint URL для правильной подписи
                    # Если endpoint содержит ru1, используем ru1, иначе проверяем настройки
                    region_for_signature = getattr(settings, 'AWS_S3_REGION_NAME_FOR_SIGNING', None)
                    
                    if not region_for_signature:
                        # Автоматически определяем регион из endpoint URL
                        if 'ru1' in endpoint_url.lower():
                            region_for_signature = 'ru1'
                        elif 'ru' in endpoint_url.lower():
                            # Извлекаем регион из URL если есть (например, ru1, ru2 и т.д.)
                            import re
                            region_match = re.search(r'\.(ru\d+)\.', endpoint_url.lower())
                            if region_match:
                                region_for_signature = region_match.group(1)
                        else:
                            # Если регион не найден, используем дефолтный (может потребоваться настройка)
                            region_for_signature = 'us-east-1'
                    
                    s3_client = boto3.client(
                        's3',
                        endpoint_url=endpoint_url,
                        aws_access_key_id=aws_access_key_id,
                        aws_secret_access_key=aws_secret_access_key,
                        region_name=region_for_signature,
                        config=Config(
                            signature_version='s3v4',
                            s3={
                                'addressing_style': 'path',  # Используем path-style вместо virtual-hosted-style
                            }
                        )
                    )
                    
                    # Генерируем подписанный URL с параметрами для CORS
                    # Важно: CORS заголовки должны быть настроены на уровне бакета в Beget
                    # Но мы можем добавить параметры для явного указания нужных заголовков
                    file_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': bucket_name,
                            'Key': obj.file.name,
                            # Добавляем параметры для CORS (если поддерживается)
                            # ResponseContentType может помочь некоторым S3-совместимым хранилищам
                        },
                        ExpiresIn=3600
                    )
                    
                    # Проверяем, что URL не содержит дублирования пути
                    if f'/{bucket_name}/{bucket_name}/' in file_url:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Обнаружено дублирование пути в URL: {file_url}")
                        # Исправляем URL, убирая дублирование
                        file_url = file_url.replace(f'/{bucket_name}/{bucket_name}/', f'/{bucket_name}/')
                    
                    # Логируем сгенерированный URL для отладки CORS проблем
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.debug(f"Сгенерирован подписанный URL для файла {obj.file.name}: {file_url}")
                    logger.debug(f"Endpoint URL: {endpoint_url}, Bucket: {bucket_name}, Region: {region_for_signature}")
                    
                    return file_url
                except Exception as e:
                    # Если не удалось сгенерировать подписанный URL, логируем ошибку
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Ошибка генерации подписанного URL через boto3: {e}", exc_info=True)
                    # Пробуем использовать storage.url() как fallback
                    if hasattr(obj.file, 'storage') and hasattr(obj.file.storage, 'url'):
                        try:
                            file_url = obj.file.storage.url(obj.file.name)
                            return file_url
                        except Exception:
                            pass
                    # Если ничего не помогло, возвращаем обычный URL (но он не будет работать для приватных файлов)
                    file_url = obj.file.url
            else:
                # Используем обычный URL для публичных файлов
                file_url = obj.file.url
            
            # Если URL уже полный (начинается с http:// или https://), возвращаем как есть
            if file_url.startswith(('http://', 'https://')):
                return file_url
            # Иначе строим абсолютный URL из запроса
            return request.build_absolute_uri(file_url) if request else file_url
        return None

    def get_file_ext(self, obj):
        """Расширение файла без точки (например glb)."""
        name = (getattr(obj.file, "name", "") or "").lower()
        if not name:
            return None
        ext = os.path.splitext(name)[1].lstrip(".")
        return ext or None


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    model_3d_id = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()
    model_glb = serializers.SerializerMethodField()

    # Новые поля для файловых ресурсов (обязательно включаем — __all__ только модель)
    asset_images = serializers.SerializerMethodField()
    asset_3d_models = serializers.SerializerMethodField()

    class Meta:
        model = Product
        # Явно включаем asset_3d_models, asset_images, images — иначе 3D не подгружаются в каталоге
        fields = (
            "id", "title", "article", "category", "subcategory", "description", "price",
            "material", "style", "color", "color_rgb", "brand", "country",
            "width", "height", "depth", "weight", "availability",
            "is_active", "is_trending", "photo_url",
            "image_asset_ids", "model_3d_asset_ids", "model_3d_id", "title_display",
            "model_glb", "model_fbx", "model_rfa", "model_ifc", "model_rfa_glb_preview",
            "model_rfa_convert_status", "model_rfa_convert_error",
            "model_usdz", "model_ar_glb",
            "shop_url", "cp_notes",
            "image", "images", "asset_images", "asset_3d_models",
        )
        ref_name = "CatalogProduct"
    
    def get_images(self, obj):
        """Получить все изображения из ProductImage с правильным контекстом"""
        request = self.context.get("request")
        images = obj.images.all().order_by('order', 'created_at')
        return ProductImageSerializer(images, many=True, context={'request': request}).data

    def get_image(self, obj):
        request = self.context.get("request")
        
        # Приоритет 1: Изображения в ProductImage (созданные через импорт)
        if obj.images.exists():
            first_image = obj.images.first()
            if first_image.image and hasattr(first_image.image, "url"):
                image_url = first_image.image.url
                if image_url.startswith(('http://', 'https://')):
                    return image_url
                return request.build_absolute_uri(image_url) if request else image_url

        # Приоритет 2: основное фото на товаре (ручная загрузка + автогенерация glb2d_*.png из GLB).
        # Раньше шло после FileAsset — превью из GLB не попадало в API, в 2D каталоге было «Нет фото».
        if obj.image and hasattr(obj.image, "url"):
            image_url = obj.image.url
            if image_url.startswith(('http://', 'https://')):
                return image_url
            return request.build_absolute_uri(image_url) if request else image_url

        # Приоритет 3: изображения из FileAsset по ID
        image_assets = obj.get_image_assets()
        if image_assets.exists():
            first_asset = image_assets.first()
            if first_asset.file and hasattr(first_asset.file, "url"):
                file_url = first_asset.file.url
                if file_url.startswith(('http://', 'https://')):
                    return file_url
                return request.build_absolute_uri(file_url) if request else file_url

        # Приоритет 4: photo_url (из Excel импорта)
        if obj.photo_url:
            return obj.photo_url

        return None
    
    def get_model_3d_id(self, obj):
        """Первый ID 3D модели из model_3d_asset_ids (например Пуф123)"""
        if not obj.model_3d_asset_ids:
            return None
        first = obj.model_3d_asset_ids.split(',')[0].strip()
        return first or None

    def get_title_display(self, obj):
        """
        Название без бренда для отображения.
        Стараемся оставить только тип мебели и цвет.
        Пример: «Табурет мягкий Handy светло-коричневого цвета» → «Табурет светло-коричневого цвета».
        """
        import re
        title = obj.title or ''
        brand = (obj.brand or '').strip()
        base = title
        if brand:
            escaped = re.escape(brand)
            pattern = re.compile(r'\s*' + escaped + r'\s*', re.IGNORECASE)
            base = pattern.sub(' ', base)
        base = re.sub(r'\s+', ' ', base).strip()
        if not base:
            return ''
        m_type = re.match(r'^\s*([^\s,]+)', base)
        item_type = m_type.group(1) if m_type else ''
        # Ищем цветовую фразу: (префикс-)слово цвет[а-я]* в конце строки.
        # Используем точный паттерн чтобы не захватить модельное название (Виконт, Maral и т.п.)
        m_color = re.search(r'((?:[А-Яа-яЁё]+-)*[А-Яа-яЁё]+\s+цвет[а-я]*)\s*$', base, re.IGNORECASE)
        if item_type and m_color:
            color_part = m_color.group(1).strip()
            return f"{item_type} {color_part}".strip()
        return base

    def get_model_glb(self, obj):
        """Вернуть URL браузерной 3D-модели, даже если она хранится только в FileAsset."""
        request = self.context.get("request")

        def is_valid_url(url):
            if not url:
                return False
            low = str(url).lower().strip()
            return low.startswith("http://") or low.startswith("https://") or low.startswith("/")

        # 1) FileAsset на нашем storage
        for asset in obj.get_3d_model_assets():
            name = (getattr(asset.file, "name", "") or "").lower()
            if not name.endswith((".glb", ".gltf", ".usdz")):
                continue
            data = FileAssetSerializer(asset, context={'request': request}).data
            file_url = data.get("file_url")
            if is_valid_url(file_url):
                return file_url

        mg = obj.model_glb
        # 2) Прямое поле — стабильные URL и реально GLB/GLTF/USDZ (.fbx в model_glb не отдаём)
        if mg and is_valid_url(mg) and url_looks_like_browser_model_file(mg) and not is_ephemeral_external_model_url(mg):
            return mg

        # 3) Превью из RFA (после convert_rfa_to_glb) — обычно тот же S3, что и RFA
        preview = obj.model_rfa_glb_preview
        if preview and is_valid_url(preview) and url_looks_like_browser_model_file(preview):
            return preview

        # 4) Fallback: что записано в model_glb (временный CDN и т.д.) — только если расширение под viewer
        if mg and is_valid_url(mg) and url_looks_like_browser_model_file(mg):
            return mg
        return None

    def get_asset_images(self, obj):
        """Получить все изображения из FileAsset"""
        request = self.context.get("request")
        image_assets = obj.get_image_assets()
        return FileAssetSerializer(image_assets, many=True, context={'request': request}).data
    
    def get_asset_3d_models(self, obj):
        """Получить все 3D модели (FileAsset + прямые URL) для отображения в каталоге и на странице товара."""
        request = self.context.get("request")
        view_action = self.context.get("view_action")
        models = []
        
        # Добавляем модели из FileAsset.
        # Для list-ответа ограничиваемся первыми GLB-подобными файлами:
        # это сильно ускоряет каталог и убирает "зависание" на генерации URL для всех ассетов.
        model_assets = obj.get_3d_model_assets()
        if view_action == 'list':
            glb_like_assets = []
            for asset in model_assets:
                name = (getattr(asset.file, "name", "") or "").lower()
                if name.endswith((".glb", ".gltf", ".usdz")):
                    glb_like_assets.append(asset)
                if len(glb_like_assets) >= 2:
                    break
            models.extend(
                FileAssetSerializer(glb_like_assets, many=True, context={'request': request}).data
            )
        else:
            models.extend(FileAssetSerializer(model_assets, many=True, context={'request': request}).data)
        
        # Функция для проверки валидности URL
        def is_valid_url(url):
            """Проверяет, является ли URL валидным HTTP URL"""
            if not url:
                return False
            url_lower = url.lower().strip()
            # Проверяем, что это HTTP URL или относительный путь
            return url_lower.startswith('http://') or url_lower.startswith('https://') or url_lower.startswith('/')
        
        # Для каталога и карточек используем только FileAsset-модели,
        # чтобы соответствие всегда было строго по ID файла.
        if view_action in ('list', 'retrieve'):
            return models

        # Для прочих сценариев (админские/внутренние) оставляем legacy fallback.
        if obj.model_glb and is_valid_url(obj.model_glb):
            models.append({
                'asset_id': 'glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_glb,
                'description': 'GLB модель'
            })
        # Не добавляем FBX/RFA в asset_3d_models: это поле используется для viewer-а.
        if obj.model_usdz and is_valid_url(obj.model_usdz):
            models.append({
                'asset_id': 'usdz_direct',
                'file_type': '3d_model',
                'file_url': obj.model_usdz,
                'description': 'USDZ модель (iOS AR)'
            })
        if obj.model_rfa_glb_preview and is_valid_url(obj.model_rfa_glb_preview):
            models.append({
                'asset_id': 'rfa_preview_glb',
                'file_type': '3d_model',
                'file_url': obj.model_rfa_glb_preview,
                'description': 'GLB превью, сгенерированное из RFA'
            })
        if obj.model_ar_glb and is_valid_url(obj.model_ar_glb):
            models.append({
                'asset_id': 'ar_glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_ar_glb,
                'description': 'AR-GLB модель'
            })
        
        return models
