from django.db import models


class FileAsset(models.Model):
    """Модель для хранения файлов (изображения и 3D модели) с уникальным ID"""
    ASSET_TYPE_CHOICES = [
        ('image', 'Изображение'),
        ('3d_model', '3D Модель'),
    ]
    
    asset_id = models.CharField(max_length=50, unique=True, verbose_name="ID файла", help_text="Уникальный идентификатор для ссылки в Excel")
    file_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES, verbose_name="Тип файла")
    file = models.FileField(upload_to="assets/", verbose_name="Файл")
    description = models.CharField(max_length=255, blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")
    
    class Meta:
        verbose_name = "Файловый ресурс"
        verbose_name_plural = "Файловые ресурсы"
        ordering = ['-created_at']
    
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
    title = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    material = models.CharField(max_length=120, blank=True)
    style = models.CharField(max_length=120, blank=True)
    color = models.CharField(max_length=60, blank=True)
    is_active = models.BooleanField(default=True)
    is_trending = models.BooleanField(default=False)
    # 🖼️ Основное изображение (для обратной совместимости)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    
    # 📦 Связь с файловыми ресурсами через ID (для импорта из Excel)
    image_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID изображений", help_text="ID изображений через запятую (например: img_001,img_002)")
    model_3d_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID 3D моделей", help_text="ID 3D моделей через запятую (например: model_001,model_002)")

    def __str__(self):
        return self.title
    
    def get_image_assets(self):
        """Получить все изображения по их ID"""
        if not self.image_asset_ids:
            return []
        ids = [id.strip() for id in self.image_asset_ids.split(',') if id.strip()]
        return FileAsset.objects.filter(asset_id__in=ids, file_type='image')
    
    def get_3d_model_assets(self):
        """Получить все 3D модели по их ID"""
        if not self.model_3d_asset_ids:
            return []
        ids = [id.strip() for id in self.model_3d_asset_ids.split(',') if id.strip()]
        return FileAsset.objects.filter(asset_id__in=ids, file_type='3d_model')


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
