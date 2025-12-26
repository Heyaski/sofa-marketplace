from rest_framework import serializers
from .models import StaticPage


class StaticPageSerializer(serializers.ModelSerializer):
    """Сериализатор для статических страниц"""
    
    class Meta:
        model = StaticPage
        fields = ['id', 'page_type', 'title', 'content', 'slug', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

