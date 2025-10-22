from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product


class Basket(models.Model):
    user = models.ForeignKey(User, related_name="baskets", on_delete=models.CASCADE)
    name = models.CharField(max_length=255, default="Новая корзина")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class BasketItem(models.Model):
    basket = models.ForeignKey(Basket, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    format = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return f"{self.product.title} x {self.quantity} ({self.format or 'без формата'})"
