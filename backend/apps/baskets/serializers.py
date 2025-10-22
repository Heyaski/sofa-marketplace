# apps/baskets/serializers.py
from rest_framework import serializers
from .models import Basket, BasketItem
from apps.catalog.models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "title", "price"]
        ref_name = "BasketProduct"


class BasketItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )

    class Meta:
        model = BasketItem
        fields = ["id", "product", "product_id", "quantity", "format"]


class BasketSerializer(serializers.ModelSerializer):
    items = BasketItemSerializer(many=True, read_only=True)

    class Meta:
        model = Basket
        fields = ["id", "name", "user", "created_at", "updated_at", "items"]
