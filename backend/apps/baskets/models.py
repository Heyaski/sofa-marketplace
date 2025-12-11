from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product


class Basket(models.Model):
    user = models.ForeignKey(User, related_name="baskets", on_delete=models.CASCADE, verbose_name="Пользователь")
    name = models.CharField(max_length=255, default="Новая корзина", verbose_name="Название")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Корзина"
        verbose_name_plural = "Корзины"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class BasketItem(models.Model):
    basket = models.ForeignKey(Basket, related_name="items", on_delete=models.CASCADE, verbose_name="Корзина")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    format = models.CharField(max_length=10, blank=True, null=True, verbose_name="Формат")

    class Meta:
        verbose_name = "Элемент корзины"
        verbose_name_plural = "Элементы корзины"

    def __str__(self):
        return f"{self.product.title} x {self.quantity} ({self.format or 'без формата'})"
