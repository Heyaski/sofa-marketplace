from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product
from apps.baskets.models import Basket, BasketItem


class Order(models.Model):
    STATUS_CHOICES = [
        ("pending", "В обработке"),
        ("paid", "Оплачен"),
        ("shipped", "Отправлен"),
        ("completed", "Завершён"),
        ("canceled", "Отменён"),
    ]

    user = models.ForeignKey(User, related_name="orders", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"Заказ #{self.id} от {self.user.username} ({self.get_status_display()})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product.title} x {self.quantity}"

    def get_total(self):
        return self.quantity * self.price
