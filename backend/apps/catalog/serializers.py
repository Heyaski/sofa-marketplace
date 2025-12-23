from rest_framework import serializers
from .models import Product, Category, ProductImage, FileAsset


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

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
    
    class Meta:
        model = FileAsset
        fields = ['asset_id', 'file_type', 'file_url', 'description']
    
    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            # Проверяем режим доступа к файлам
            from django.conf import settings
            use_signed_urls = getattr(settings, 'S3_FILE_ACCESS_MODE', 'public') == 'signed'
            
            if use_signed_urls and hasattr(obj.file, 'storage'):
                # Генерируем подписанный URL для приватных файлов
                try:
                    storage = obj.file.storage
                    # Используем метод url() storage, который автоматически генерирует подписанный URL
                    # когда AWS_QUERYSTRING_AUTH = True
                    file_url = storage.url(obj.file.name)
                    # Подписанный URL уже полный и содержит query параметры с подписью
                    return file_url
                except Exception as e:
                    # Если не удалось сгенерировать подписанный URL, логируем ошибку
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Ошибка генерации подписанного URL: {e}")
                    # Возвращаем обычный URL как fallback (но он не будет работать для приватных файлов)
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


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    
    # Новые поля для файловых ресурсов
    asset_images = serializers.SerializerMethodField()
    asset_3d_models = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = "__all__"
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
        
        # Приоритет 2: Изображения из FileAsset по ID
        image_assets = obj.get_image_assets()
        if image_assets.exists():
            first_asset = image_assets.first()
            if first_asset.file and hasattr(first_asset.file, "url"):
                file_url = first_asset.file.url
                if file_url.startswith(('http://', 'https://')):
                    return file_url
                return request.build_absolute_uri(file_url) if request else file_url
        
        # Приоритет 3: photo_url (из Excel импорта)
        if obj.photo_url:
            return obj.photo_url
        
        # Приоритет 4: Старое поле image (для обратной совместимости)
        if obj.image and hasattr(obj.image, "url"):
            image_url = obj.image.url
            if image_url.startswith(('http://', 'https://')):
                return image_url
            return request.build_absolute_uri(image_url) if request else image_url
        return None
    
    def get_asset_images(self, obj):
        """Получить все изображения из FileAsset"""
        request = self.context.get("request")
        image_assets = obj.get_image_assets()
        return FileAssetSerializer(image_assets, many=True, context={'request': request}).data
    
    def get_asset_3d_models(self, obj):
        """Получить все 3D модели (FileAsset + прямые URL)"""
        request = self.context.get("request")
        models = []
        
        # Добавляем модели из FileAsset
        model_assets = obj.get_3d_model_assets()
        models.extend(FileAssetSerializer(model_assets, many=True, context={'request': request}).data)
        
        # Функция для проверки валидности URL
        def is_valid_url(url):
            """Проверяет, является ли URL валидным HTTP URL"""
            if not url:
                return False
            url_lower = url.lower().strip()
            # Проверяем, что это HTTP URL или относительный путь
            return url_lower.startswith('http://') or url_lower.startswith('https://') or url_lower.startswith('/')
        
        # Добавляем прямые URL моделей (из Excel импорта) только если это валидные HTTP URL
        if obj.model_glb and is_valid_url(obj.model_glb):
            models.append({
                'asset_id': 'glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_glb,
                'description': 'GLB модель'
            })
        # FBX не поддерживается для просмотра в браузере, но оставляем для скачивания
        if obj.model_fbx and is_valid_url(obj.model_fbx):
            models.append({
                'asset_id': 'fbx_direct',
                'file_type': '3d_model',
                'file_url': obj.model_fbx,
                'description': 'FBX модель (не поддерживается для просмотра)'
            })
        if obj.model_usdz and is_valid_url(obj.model_usdz):
            models.append({
                'asset_id': 'usdz_direct',
                'file_type': '3d_model',
                'file_url': obj.model_usdz,
                'description': 'USDZ модель (iOS AR)'
            })
        # RFA не поддерживается для просмотра в браузере, но оставляем для скачивания
        if obj.model_rfa and is_valid_url(obj.model_rfa):
            models.append({
                'asset_id': 'rfa_direct',
                'file_type': '3d_model',
                'file_url': obj.model_rfa,
                'description': 'RFA модель (Revit, не поддерживается для просмотра)'
            })
        if obj.model_ar_glb and is_valid_url(obj.model_ar_glb):
            models.append({
                'asset_id': 'ar_glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_ar_glb,
                'description': 'AR-GLB модель'
            })
        
        return models
