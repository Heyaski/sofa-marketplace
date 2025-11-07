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
    # 🖼️ Новое поле для фото товара
    image = models.ImageField(upload_to="products/", blank=True, null=True)

    def __str__(self):
        return self.title
