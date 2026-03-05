import re
from rest_framework import serializers
from .models import Download
from apps.catalog.models import Product

class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ["id", "title", "price", "image", "title_display"]
    
    def get_title_display(self, obj):
        title = obj.title or ''
        brand = (obj.brand or '').strip()
        if not brand:
            return title
        escaped = re.escape(brand)
        pattern = re.compile(r'\s*' + escaped + r'\s*', re.IGNORECASE)
        return re.sub(r'\s+', ' ', pattern.sub(' ', title)).strip()

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

class DownloadSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Download
        fields = ["id", "product", "created_at", "file"]
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Добавляем контекст request для сериализации продукта
        if 'request' in self.context:
            representation['product'] = ProductSerializer(
                instance.product,
                context=self.context
            ).data
        return representation
