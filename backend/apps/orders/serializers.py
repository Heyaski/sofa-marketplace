from rest_framework import serializers
from .models import Order, OrderItem
from apps.catalog.models import Product


class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.StringRelatedField()

    class Meta:
        model = OrderItem
        fields = ["id", "product", "quantity", "price"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "user", "created_at", "status", "total_price", "items"]
        read_only_fields = ["user", "created_at", "total_price", "status"]
