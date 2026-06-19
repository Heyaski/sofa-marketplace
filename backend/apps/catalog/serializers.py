from rest_framework import serializers
from .models import Product, Category, ProductImage, FileAsset
from .file_urls import is_ephemeral_external_model_url, url_looks_like_browser_model_file
from .media_urls import resolve_media_field_url, resolve_object_key_url
import os


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    parent_category = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = "__all__"

    def get_image(self, obj):
        request = self.context.get("request")
        return resolve_media_field_url(obj.image, request)
    
    def get_parent_category(self, obj):
        """Возвращает информацию о родительской категории, если она есть"""
        if obj.parent:
            return {
                'id': obj.parent.id,
                'name': obj.parent.name,
                'slug': obj.parent.slug,
            }
        return None


class CategoryLiteSerializer(serializers.ModelSerializer):
    """Список каталога / вложенная категория товара — без presigned image (ускорение API)."""

    parent_category = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "name", "slug", "parent", "parent_category")

    def get_parent_category(self, obj):
        if obj.parent:
            return {
                "id": obj.parent.id,
                "name": obj.parent.name,
                "slug": obj.parent.slug,
            }
        return None


class ProductImageSerializer(serializers.ModelSerializer):
    """Сериализатор для изображений товара"""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image_url', 'order']

    def get_image_url(self, obj):
        request = self.context.get("request")
        return resolve_media_field_url(obj.image, request)


class FileAssetSerializer(serializers.ModelSerializer):
    """Сериализатор для файловых ресурсов"""
    file_url = serializers.SerializerMethodField()
    file_ext = serializers.SerializerMethodField()
    
    class Meta:
        model = FileAsset
        fields = ['asset_id', 'file_type', 'file_url', 'file_ext', 'description']
    
    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        return resolve_media_field_url(obj.file, request)

    def get_file_ext(self, obj):
        """Расширение файла без точки (например glb)."""
        name = (getattr(obj.file, "name", "") or "").lower()
        if not name:
            return None
        ext = os.path.splitext(name)[1].lstrip(".")
        return ext or None


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    model_3d_id = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()
    model_glb = serializers.SerializerMethodField()
    model_usdz = serializers.SerializerMethodField()
    model_fbx = serializers.SerializerMethodField()

    # Новые поля для файловых ресурсов (обязательно включаем — __all__ только модель)
    asset_images = serializers.SerializerMethodField()
    asset_3d_models = serializers.SerializerMethodField()

    class Meta:
        model = Product
        # Явно включаем asset_3d_models, asset_images, images — иначе 3D не подгружаются в каталоге
        fields = (
            "id", "title", "article", "category", "subcategory", "description", "price",
            "material", "style", "color", "color_rgb", "brand", "country",
            "width", "height", "depth", "weight",
            "is_active", "is_trending", "photo_url",
            "image_asset_ids", "model_3d_asset_ids", "model_3d_id", "title_display",
            "model_glb", "model_fbx", "model_rfa", "model_ifc", "model_rfa_glb_preview",
            "model_rfa_convert_status", "model_rfa_convert_error",
            "model_usdz", "model_ar_glb",
            "shop_url", "cp_notes",
            "image", "images", "asset_images", "asset_3d_models",
        )
        ref_name = "CatalogProduct"
    
    def get_images(self, obj):
        """Получить все изображения из ProductImage с правильным контекстом"""
        if self.context.get("view_action") == "list":
            return []
        request = self.context.get("request")
        images = obj.images.all().order_by('order', 'created_at')
        return ProductImageSerializer(images, many=True, context={'request': request}).data

    def get_image(self, obj):
        request = self.context.get("request")
        view_action = self.context.get("view_action")

        # 1) Product.image — glb2d_*.png и ручная загрузка (главный источник для 2D каталога)
        url = resolve_media_field_url(obj.image, request)
        if url:
            return url

        # 2) ProductImage (импорт)
        for product_image in obj.images.all().order_by("order", "created_at"):
            url = resolve_media_field_url(product_image.image, request)
            if url:
                return url

        # 3) FileAsset-изображения (дорого для списка — только карточка/retrieve)
        if view_action != "list":
            for asset in obj.get_image_assets():
                url = resolve_media_field_url(asset.file, request)
                if url:
                    return url

        # 4) photo_url из Excel
        photo = (obj.photo_url or "").strip()
        if photo:
            return photo

        return None
    
    def get_model_3d_id(self, obj):
        """Первый ID 3D модели из model_3d_asset_ids (например Пуф123)"""
        if not obj.model_3d_asset_ids:
            return None
        first = obj.model_3d_asset_ids.split(',')[0].strip()
        return first or None

    def get_title_display(self, obj):
        """
        Название без бренда для отображения.
        Стараемся оставить только тип мебели и цвет.
        Пример: «Табурет мягкий Handy светло-коричневого цвета» → «Табурет светло-коричневого цвета».
        """
        import re
        title = obj.title or ''
        brand = (obj.brand or '').strip()
        base = title
        if brand:
            escaped = re.escape(brand)
            pattern = re.compile(r'\s*' + escaped + r'\s*', re.IGNORECASE)
            base = pattern.sub(' ', base)
        base = re.sub(r'\s+', ' ', base).strip()
        if not base:
            return ''
        m_type = re.match(r'^\s*([^\s,]+)', base)
        item_type = m_type.group(1) if m_type else ''
        # Ищем цветовую фразу: (префикс-)слово цвет[а-я]* в конце строки.
        # Используем точный паттерн чтобы не захватить модельное название (Виконт, Maral и т.п.)
        m_color = re.search(r'((?:[А-Яа-яЁё]+-)*[А-Яа-яЁё]+\s+цвет[а-я]*)\s*$', base, re.IGNORECASE)
        if item_type and m_color:
            color_part = m_color.group(1).strip()
            return f"{item_type} {color_part}".strip()
        return base

    def get_model_glb(self, obj):
        """Вернуть URL браузерной 3D-модели, даже если она хранится только в FileAsset."""
        request = self.context.get("request")

        def is_valid_url(url):
            if not url:
                return False
            low = str(url).lower().strip()
            return low.startswith("http://") or low.startswith("https://") or low.startswith("/")

        # 1) FileAsset на нашем storage (список + model_files: из batched-кеша во views)
        batch_map = self.context.get("catalog_list_3d_by_product_id")
        if self.context.get("view_action") == "list":
            assets_iter = batch_map.get(obj.id, []) if batch_map is not None else []
        else:
            assets_iter = (
                batch_map.get(obj.id, [])
                if batch_map is not None
                else obj.get_3d_model_assets()
            )
        for asset in assets_iter:
            name = (getattr(asset.file, "name", "") or "").lower()
            if not name.endswith((".glb", ".gltf", ".usdz")):
                continue
            data = FileAssetSerializer(asset, context={'request': request}).data
            file_url = data.get("file_url")
            if is_valid_url(file_url):
                return file_url

        mg = (obj.model_glb or "").strip()
        # 2) Прямое поле — URL или ключ в S3 (assets/….glb)
        if mg and url_looks_like_browser_model_file(mg):
            if is_valid_url(mg) and not is_ephemeral_external_model_url(mg):
                return mg
            key_url = resolve_object_key_url(mg, request)
            if key_url:
                return key_url

        # 3) Превью из RFA (после convert_rfa_to_glb)
        preview = (obj.model_rfa_glb_preview or "").strip()
        if preview and url_looks_like_browser_model_file(preview):
            if is_valid_url(preview) and not is_ephemeral_external_model_url(preview):
                return preview
            key_url = resolve_object_key_url(preview, request)
            if key_url:
                return key_url

        return None

    def get_model_usdz(self, obj):
        """Абсолютный URL USDZ для AR Quick Look (iOS Safari)."""
        request = self.context.get("request")

        def is_valid_url(url):
            if not url:
                return False
            low = str(url).lower().strip()
            return low.startswith("http://") or low.startswith("https://") or low.startswith("/")

        batch_map = self.context.get("catalog_list_3d_by_product_id")
        if self.context.get("view_action") == "list":
            assets_iter = batch_map.get(obj.id, []) if batch_map is not None else []
        else:
            assets_iter = (
                batch_map.get(obj.id, [])
                if batch_map is not None
                else obj.get_3d_model_assets()
            )
        for asset in assets_iter:
            name = (getattr(asset.file, "name", "") or "").lower()
            if not name.endswith(".usdz"):
                continue
            data = FileAssetSerializer(asset, context={"request": request}).data
            file_url = data.get("file_url")
            if is_valid_url(file_url):
                return file_url

        raw = (obj.model_usdz or "").strip()
        if raw and url_looks_like_browser_model_file(raw) and raw.lower().endswith(".usdz"):
            if is_valid_url(raw) and not is_ephemeral_external_model_url(raw):
                return raw
            key_url = resolve_object_key_url(raw, request)
            if key_url:
                return key_url
        return None

    def get_model_fbx(self, obj):
        """Абсолютный URL FBX (поле model_fbx или FileAsset)."""
        request = self.context.get("request")

        def is_valid_url(url):
            if not url:
                return False
            low = str(url).lower().strip()
            return low.startswith("http://") or low.startswith("https://") or low.startswith("/")

        batch_map = self.context.get("catalog_list_3d_by_product_id")
        if self.context.get("view_action") == "list":
            assets_iter = batch_map.get(obj.id, []) if batch_map is not None else []
        else:
            assets_iter = (
                batch_map.get(obj.id, [])
                if batch_map is not None
                else obj.get_3d_model_assets()
            )
        for asset in assets_iter:
            name = (getattr(asset.file, "name", "") or "").lower()
            if not name.endswith(".fbx"):
                continue
            data = FileAssetSerializer(asset, context={"request": request}).data
            file_url = data.get("file_url")
            if is_valid_url(file_url):
                return file_url

        raw = (obj.model_fbx or "").strip()
        if not raw:
            return None
        if is_valid_url(raw) and not is_ephemeral_external_model_url(raw):
            if raw.lower().split("?")[0].endswith(".fbx"):
                return raw if raw.startswith(("http://", "https://")) else resolve_object_key_url(raw, request) or raw
        if raw.lower().endswith(".fbx"):
            return resolve_object_key_url(raw, request)
        return None

    def get_asset_images(self, obj):
        """Получить все изображения из FileAsset"""
        if self.context.get("view_action") == "list":
            return []
        request = self.context.get("request")
        image_assets = obj.get_image_assets()
        return FileAssetSerializer(image_assets, many=True, context={'request': request}).data
    
    def get_asset_3d_models(self, obj):
        """Получить все 3D модели (FileAsset + прямые URL) для отображения в каталоге и на странице товара."""
        request = self.context.get("request")
        view_action = self.context.get("view_action")
        models = []
        
        # Добавляем модели из FileAsset.
        # Для list-ответа ограничиваемся первыми GLB-подобными файлами:
        # это сильно ускоряет каталог и убирает "зависание" на генерации URL для всех ассетов.
        batch_map = self.context.get("catalog_list_3d_by_product_id")
        if view_action == "list":
            model_assets = (
                batch_map.get(obj.id, [])
                if batch_map is not None
                else []
            )
        else:
            model_assets = obj.get_3d_model_assets()
        if view_action == 'list':
            glb_like_assets = []
            for asset in model_assets:
                name = (getattr(asset.file, "name", "") or "").lower()
                if name.endswith((".glb", ".gltf", ".usdz", ".fbx")):
                    glb_like_assets.append(asset)
                if len(glb_like_assets) >= 3:
                    break
            models.extend(
                FileAssetSerializer(glb_like_assets, many=True, context={'request': request}).data
            )
        else:
            models.extend(FileAssetSerializer(model_assets, many=True, context={'request': request}).data)
        
        # Функция для проверки валидности URL
        def is_valid_url(url):
            """Проверяет, является ли URL валидным HTTP URL"""
            if not url:
                return False
            url_lower = url.lower().strip()
            # Проверяем, что это HTTP URL или относительный путь
            return url_lower.startswith('http://') or url_lower.startswith('https://') or url_lower.startswith('/')
        
        # Для каталога и карточек используем только FileAsset-модели,
        # чтобы соответствие всегда было строго по ID файла.
        if view_action in ('list', 'retrieve'):
            return models

        # Для прочих сценариев (админские/внутренние) оставляем legacy fallback.
        if obj.model_glb and is_valid_url(obj.model_glb):
            models.append({
                'asset_id': 'glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_glb,
                'description': 'GLB модель'
            })
        # Не добавляем FBX/RFA в asset_3d_models: это поле используется для viewer-а.
        if obj.model_usdz and is_valid_url(obj.model_usdz):
            models.append({
                'asset_id': 'usdz_direct',
                'file_type': '3d_model',
                'file_url': obj.model_usdz,
                'description': 'USDZ модель (iOS AR)'
            })
        if obj.model_rfa_glb_preview and is_valid_url(obj.model_rfa_glb_preview):
            models.append({
                'asset_id': 'rfa_preview_glb',
                'file_type': '3d_model',
                'file_url': obj.model_rfa_glb_preview,
                'description': 'GLB превью, сгенерированное из RFA'
            })
        if obj.model_ar_glb and is_valid_url(obj.model_ar_glb):
            models.append({
                'asset_id': 'ar_glb_direct',
                'file_type': '3d_model',
                'file_url': obj.model_ar_glb,
                'description': 'AR-GLB модель'
            })
        
        return models


class ProductCatalogLiteSerializer(serializers.ModelSerializer):
    """
    Быстрый список для 2D-каталога (без model_files в query).
    Без presigned URL для каждого FileAsset 3D и без тяжёлых полей моделей.
    """

    category = CategoryLiteSerializer(read_only=True)
    image = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "title",
            "article",
            "category",
            "subcategory",
            "description",
            "price",
            "material",
            "style",
            "color",
            "color_rgb",
            "brand",
            "country",
            "width",
            "height",
            "depth",
            "weight",
            "is_active",
            "is_trending",
            "photo_url",
            "title_display",
            "image",
        )
        ref_name = "CatalogProductLite"

    def get_title_display(self, obj):
        return ProductSerializer.get_title_display(self, obj)

    def get_image(self, obj):
        """
        Режим 2D каталога: PNG-превью (glb2d_*.png в Product.image).
        Не путать со страницей товара — там GLB/IFC в model-viewer.
        """
        request = self.context.get("request")
        url = resolve_media_field_url(obj.image, request)
        if url:
            return url
        for product_image in obj.images.all().order_by("order", "created_at")[:1]:
            url = resolve_media_field_url(product_image.image, request)
            if url:
                return url
        photo = (obj.photo_url or "").strip()
        if photo.startswith(("http://", "https://")):
            return photo
        return None


class ProductCatalog3DSerializer(ProductCatalogLiteSerializer):
    """
    Список 3D-каталога (model_files=bundle): без тяжёлого ProductSerializer и без N+1 по FileAsset.
    """

    model_3d_id = serializers.SerializerMethodField()
    model_glb = serializers.SerializerMethodField()
    model_fbx = serializers.SerializerMethodField()
    model_rfa_glb_preview = serializers.CharField(read_only=True)
    asset_3d_models = serializers.SerializerMethodField()

    class Meta(ProductCatalogLiteSerializer.Meta):
        fields = ProductCatalogLiteSerializer.Meta.fields + (
            "model_3d_id",
            "model_glb",
            "model_fbx",
            "model_rfa_glb_preview",
            "asset_3d_models",
        )

    def get_model_3d_id(self, obj):
        return ProductSerializer.get_model_3d_id(self, obj)

    def get_model_glb(self, obj):
        return ProductSerializer.get_model_glb(self, obj)

    def get_model_fbx(self, obj):
        return ProductSerializer.get_model_fbx(self, obj)

    def get_asset_3d_models(self, obj):
        return ProductSerializer.get_asset_3d_models(self, obj)
