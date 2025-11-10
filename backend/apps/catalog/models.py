from django.db import models


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

    def __str__(self):
        return self.title


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
