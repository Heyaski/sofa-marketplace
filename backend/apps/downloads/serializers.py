from rest_framework import serializers
from .models import Download
from apps.catalog.models import Product

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "title", "price"]

class DownloadSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Download
        fields = ["id", "product", "created_at", "file"]
