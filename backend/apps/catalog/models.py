from django.db import models


class FileAsset(models.Model):
    """Модель для хранения файлов (изображения и 3D модели) с уникальным ID"""
    ASSET_TYPE_CHOICES = [
        ('image', 'Изображение'),
        ('3d_model', '3D Модель'),
    ]
    
    asset_id = models.CharField(max_length=50, verbose_name="ID файла", help_text="Уникальный идентификатор для ссылки в Excel")
    file_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES, verbose_name="Тип файла")
    file = models.FileField(upload_to="assets/", verbose_name="Файл")
    description = models.CharField(max_length=255, blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")
    
    class Meta:
        verbose_name = "Файловый ресурс"
        verbose_name_plural = "Файловые ресурсы"
        ordering = ['-created_at']
        # Составная уникальность: один asset_id может быть для image и для 3d_model
        constraints = [
            models.UniqueConstraint(fields=['asset_id', 'file_type'], name='unique_asset_id_per_type')
        ]
    
    def __str__(self):
        return f"{self.asset_id} ({self.get_file_type_display()})"


class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    AVAILABILITY_CHOICES = [
        ('in_stock', 'В наличии'),
        ('on_order', 'Под заказ'),
        ('out_of_stock', 'Нет в наличии'),
    ]
    
    title = models.CharField(max_length=255, verbose_name="Название")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, verbose_name="Категория")
    subcategory = models.CharField(max_length=120, blank=True, verbose_name="Подкатегория")
    description = models.TextField(blank=True, verbose_name="Описание")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена")
    
    # Характеристики
    article = models.CharField(max_length=100, blank=True, verbose_name="Артикул", db_index=True)
    material = models.CharField(max_length=120, blank=True, verbose_name="Материал")
    style = models.CharField(max_length=120, blank=True, verbose_name="Стиль")
    color = models.CharField(max_length=60, blank=True, verbose_name="Цвет")
    brand = models.CharField(max_length=120, blank=True, verbose_name="Бренд")
    country = models.CharField(max_length=120, blank=True, verbose_name="Страна")
    
    # Размеры (в см/мм)
    width = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Ширина")
    height = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Высота")
    depth = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Глубина")
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Вес (кг)")
    
    # Наличие
    availability = models.CharField(max_length=20, choices=AVAILABILITY_CHOICES, default='in_stock', verbose_name="Наличие")
    
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    is_trending = models.BooleanField(default=False, verbose_name="В тренде")
    
    # 🖼️ Основное изображение (для обратной совместимости)
    image = models.ImageField(upload_to="products/", blank=True, null=True, verbose_name="Основное фото")
    
    # 📦 URL фотографий (из Excel)
    photo_url = models.URLField(max_length=500, blank=True, verbose_name="URL фото")
    
    # 📦 Связь с файловыми ресурсами через ID (для импорта из Excel)
    image_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID изображений", help_text="ID изображений через запятую (например: img_001,img_002)")
    model_3d_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID 3D моделей", help_text="ID 3D моделей через запятую (например: model_001,model_002)")
    
    # 📦 Файлы 3D моделей (URL или пути из Excel)
    model_fbx = models.CharField(max_length=500, blank=True, verbose_name="FBX файл")
    model_glb = models.CharField(max_length=500, blank=True, verbose_name="GLB файл")
    model_rfa = models.CharField(max_length=500, blank=True, verbose_name="RFA файл")
    model_usdz = models.CharField(max_length=500, blank=True, verbose_name="USDZ файл")
    model_ar_glb = models.CharField(max_length=500, blank=True, verbose_name="AR-GLB файл")

    def __str__(self):
        return self.title
    
    def get_image_assets(self):
        """Получить все изображения по их ID"""
        if not self.image_asset_ids:
            return FileAsset.objects.none()  # Возвращаем пустой QuerySet, а не список
        ids = [id.strip() for id in self.image_asset_ids.split(',') if id.strip()]
        if not ids:
            return FileAsset.objects.none()
        return FileAsset.objects.filter(asset_id__in=ids, file_type='image')
    
    def get_3d_model_assets(self):
        """Получить все 3D модели по их ID"""
        if not self.model_3d_asset_ids:
            return FileAsset.objects.none()  # Возвращаем пустой QuerySet, а не список
        ids = [id.strip() for id in self.model_3d_asset_ids.split(',') if id.strip()]
        if not ids:
            return FileAsset.objects.none()
        return FileAsset.objects.filter(asset_id__in=ids, file_type='3d_model')
    
    def get_glb_url(self):
        """Получить URL GLB модели (приоритет: model_glb, затем FileAsset)"""
        if self.model_glb:
            return self.model_glb
        # Проверяем FileAsset
        assets = self.get_3d_model_assets()
        for asset in assets:
            if asset.file and asset.file.url.lower().endswith('.glb'):
                return asset.file.url
        return None


class ProductImage(models.Model):
    """Модель для хранения нескольких изображений товара"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to="products/", blank=False, null=False)
    order = models.PositiveIntegerField(default=0, help_text="Порядок отображения изображения")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = "Изображение товара"
        verbose_name_plural = "Изображения товаров"

    def __str__(self):
        return f"Изображение {self.order + 1} для {self.product.title}"
