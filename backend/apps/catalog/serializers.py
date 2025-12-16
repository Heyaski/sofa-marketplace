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
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
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
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
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
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
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
                return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url
        
        # Приоритет 2: Изображения из FileAsset по ID
        image_assets = obj.get_image_assets()
        if image_assets.exists():
            first_asset = image_assets.first()
            if first_asset.file and hasattr(first_asset.file, "url"):
                return request.build_absolute_uri(first_asset.file.url) if request else first_asset.file.url
        
        # Приоритет 3: photo_url (из Excel импорта)
        if obj.photo_url:
            return obj.photo_url
        
        # Приоритет 4: Старое поле image (для обратной совместимости)
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
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
        
        # Добавляем прямые URL моделей (из Excel импорта)
        if obj.model_glb:
            models.append({
                'asset_id': 'glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_glb,
                'description': 'GLB модель'
            })
        if obj.model_fbx:
            models.append({
                'asset_id': 'fbx_direct',
                'file_type': '3d_model',
                'file_url': obj.model_fbx,
                'description': 'FBX модель'
            })
        if obj.model_usdz:
            models.append({
                'asset_id': 'usdz_direct',
                'file_type': '3d_model',
                'file_url': obj.model_usdz,
                'description': 'USDZ модель (iOS AR)'
            })
        if obj.model_rfa:
            models.append({
                'asset_id': 'rfa_direct',
                'file_type': '3d_model',
                'file_url': obj.model_rfa,
                'description': 'RFA модель (Revit)'
            })
        if obj.model_ar_glb:
            models.append({
                'asset_id': 'ar_glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_ar_glb,
                'description': 'AR-GLB модель'
            })
        
        return models
