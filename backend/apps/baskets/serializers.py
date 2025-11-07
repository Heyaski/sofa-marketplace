# apps/baskets/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Basket, BasketItem
from apps.catalog.models import Product


class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ["id", "title", "price", "image"]
        ref_name = "BasketProduct"
    
    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class BasketItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )

    class Meta:
        model = BasketItem
        fields = ["id", "product", "product_id", "quantity", "format"]


class BasketUserSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор пользователя для корзины"""
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class BasketSerializer(serializers.ModelSerializer):
    items = BasketItemSerializer(many=True, read_only=True)
    user = BasketUserSerializer(read_only=True)

    class Meta:
        model = Basket
        fields = ["id", "name", "user", "created_at", "updated_at", "items"]
        read_only_fields = ["user", "created_at", "updated_at"]
