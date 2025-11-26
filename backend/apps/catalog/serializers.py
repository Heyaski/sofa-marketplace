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
    images = ProductImageSerializer(many=True, read_only=True, source='images.all')
    
    # Новые поля для файловых ресурсов
    asset_images = serializers.SerializerMethodField()
    asset_3d_models = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = "__all__"
        ref_name = "CatalogProduct"

    def get_image(self, obj):
        request = self.context.get("request")
        
        # Приоритет 1: Изображения из FileAsset по ID
        image_assets = obj.get_image_assets()
        if image_assets.exists():
            first_asset = image_assets.first()
            if first_asset.file and hasattr(first_asset.file, "url"):
                return request.build_absolute_uri(first_asset.file.url) if request else first_asset.file.url
        
        # Приоритет 2: Изображения в ProductImage
        if obj.images.exists():
            first_image = obj.images.first()
            if first_image.image and hasattr(first_image.image, "url"):
                return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url
        
        # Приоритет 3: Старое поле image (для обратной совместимости)
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None
    
    def get_asset_images(self, obj):
        """Получить все изображения из FileAsset"""
        request = self.context.get("request")
        image_assets = obj.get_image_assets()
        return FileAssetSerializer(image_assets, many=True, context={'request': request}).data
    
    def get_asset_3d_models(self, obj):
        """Получить все 3D модели из FileAsset"""
        request = self.context.get("request")
        model_assets = obj.get_3d_model_assets()
        return FileAssetSerializer(model_assets, many=True, context={'request': request}).data
