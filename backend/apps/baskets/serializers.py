# apps/baskets/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Basket, BasketItem, BasketEditRequest
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
    share_token = serializers.CharField(read_only=True)
    share_url = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Basket
        fields = ["id", "name", "user", "created_at", "updated_at", "items", "share_token", "share_url", "can_edit", "is_owner"]
        read_only_fields = ["user", "created_at", "updated_at", "share_token"]
    
    def get_share_url(self, obj):
        request = self.context.get("request")
        if obj.share_token:
            return obj.get_share_url(request)
        return None
    
    def get_can_edit(self, obj):
        """Проверяет, может ли текущий пользователь редактировать корзину"""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        
        # Владелец всегда может редактировать
        if obj.user == request.user:
            return True
        
        # Проверяем, есть ли одобренный запрос на редактирование
        return BasketEditRequest.objects.filter(
            basket=obj,
            requester=request.user,
            status='approved'
        ).exists()
    
    def get_is_owner(self, obj):
        """Проверяет, является ли текущий пользователь владельцем корзины"""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.user == request.user


class BasketEditRequestSerializer(serializers.ModelSerializer):
    """Сериализатор для запросов на редактирование корзины"""
    requester = BasketUserSerializer(read_only=True)
    basket = BasketSerializer(read_only=True)
    basket_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = BasketEditRequest
        fields = ["id", "basket", "basket_id", "requester", "status", "created_at", "updated_at", "message"]
        read_only_fields = ["requester", "status", "created_at", "updated_at"]
