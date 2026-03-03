# apps/baskets/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Q
from .models import Basket, BasketItem, BasketEditRequest, CommercialProposalRequest
from apps.catalog.models import Product, FileAsset
from apps.catalog.serializers import FileAssetSerializer


class ProductSerializer(serializers.ModelSerializer):
    """Сериализатор товара для корзины: 2D изображение, model_3d_id, title_display."""
    image = serializers.SerializerMethodField()
    model_3d_id = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "title", "price", "image", "article", "model_3d_id", "title_display"]
        ref_name = "BasketProduct"

    def get_model_3d_id(self, obj):
        """Первый ID 3D модели (например Пуф1667)"""
        if not obj.model_3d_asset_ids:
            return None
        first = obj.model_3d_asset_ids.split(',')[0].strip()
        return first or None

    def get_title_display(self, obj):
        """Название без бренда. НЕ удаляем, если brand похож на цвет."""
        title = obj.title or ''
        brand = (obj.brand or '').strip()
        if not brand:
            return title
        import re
        color_pattern = re.compile(
            r'цвета?$|цветовой|коричнев|чёрн|черн|бел|син|сер|красн|зелен|зёл|жёлт|оранж|беж|золот|серебр|фиолет|розов',
            re.IGNORECASE
        )
        if color_pattern.search(brand):
            return title
        escaped = re.escape(brand)
        pattern = re.compile(r'\s*' + escaped + r'\s*', re.IGNORECASE)
        return re.sub(r'\s+', ' ', pattern.sub(' ', title)).strip()

    def get_image(self, obj):
        """Возвращает URL изображения. Приоритет как в каталоге. Для S3 используем FileAssetSerializer."""
        request = self.context.get("request")
        # 1. ProductImage (связанные изображения)
        first_pi = obj.images.first()
        if first_pi and first_pi.image and hasattr(first_pi.image, "url"):
            url = first_pi.image.url
            if url.startswith(('http://', 'https://')):
                return url
            return request.build_absolute_uri(url) if request else url
        # 2. FileAsset (image_asset_ids) — через FileAssetSerializer для правильных signed URLs
        first_asset = obj.get_image_assets().first()
        if first_asset:
            ser = FileAssetSerializer(first_asset, context={"request": request})
            file_url = ser.data.get("file_url")
            if file_url:
                return file_url
        # 3. FileAsset по артикулу (asset_id совпадает с артикулом: IMR-556065, IMR-556065(1))
        if obj.article and obj.article.strip():
            article_clean = obj.article.strip()
            asset = FileAsset.objects.filter(
                Q(asset_id__iexact=article_clean) | Q(asset_id__istartswith=article_clean + '('),
                file_type='image',
            ).order_by('asset_id').first()
            if asset:
                ser = FileAssetSerializer(asset, context={"request": request})
                file_url = ser.data.get("file_url")
                if file_url:
                    return file_url
        # 4. photo_url (из Excel)
        if obj.photo_url:
            return obj.photo_url
        # 5. Старое поле image
        if obj.image and hasattr(obj.image, "url"):
            url = obj.image.url
            if url.startswith(('http://', 'https://')):
                return url
            return request.build_absolute_uri(url) if request else url
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


class CommercialProposalRequestSerializer(serializers.ModelSerializer):
    """Сериализатор для запросов на коммерческое предложение"""
    basket_id = serializers.IntegerField(write_only=True)
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CommercialProposalRequest
        fields = [
            "id", "basket_id", "client_name", "company_name", 
            "email", "telegram", "delivery_method", "project_name",
            "status", "pdf_url", "created_at"
        ]
        read_only_fields = ["status", "created_at"]
    
    def get_pdf_url(self, obj):
        request = self.context.get("request")
        if obj.pdf_file and hasattr(obj.pdf_file, "url"):
            return request.build_absolute_uri(obj.pdf_file.url) if request else obj.pdf_file.url
        return None
    
    def validate(self, data):
        """Проверяем, что указан хотя бы один канал связи"""
        delivery_method = data.get('delivery_method', 'email')
        if delivery_method == 'email' and not data.get('email'):
            raise serializers.ValidationError({"email": "Укажите email для отправки КП"})
        if delivery_method == 'telegram' and not data.get('telegram'):
            raise serializers.ValidationError({"telegram": "Укажите Telegram для отправки КП"})
        return data
