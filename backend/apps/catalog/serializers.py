from rest_framework import serializers
from .models import Product, Category, ProductImage


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


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True, source='images.all')

    class Meta:
        model = Product
        fields = "__all__"
        ref_name = "CatalogProduct"

    def get_image(self, obj):
        request = self.context.get("request")
        # Если есть изображения в ProductImage, возвращаем первое
        if obj.images.exists():
            first_image = obj.images.first()
            if first_image.image and hasattr(first_image.image, "url"):
                return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url
        # Иначе возвращаем старое поле image (для обратной совместимости)
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None
