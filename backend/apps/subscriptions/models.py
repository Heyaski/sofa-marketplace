from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils.timezone import now


class Plan(models.Model):
    SUBSCRIPTION_TYPE_CHOICES = [
        ('basic', 'Базовая'),
        ('premium', 'Премиум'),
    ]
    
    name = models.CharField(max_length=100, verbose_name="Название")
    subscription_type = models.CharField(
        max_length=10,
        choices=SUBSCRIPTION_TYPE_CHOICES,
        unique=True,
        verbose_name="Тип подписки",
        help_text="Используется для связи с системой подписок (basic, premium)"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена (руб.)")
    duration_days = models.PositiveIntegerField(default=30, verbose_name="Длительность (дней)")
    description = models.TextField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Описание",
        help_text="Описание подписки для чека (например: 'Базовая подписка - 10 скачиваний в месяц')"
    )
    is_active = models.BooleanField(default=True, verbose_name="Активен", help_text="Отключенные планы не будут доступны для покупки")

    class Meta:
        verbose_name = "План подписки"
        verbose_name_plural = "Планы подписок"
        ordering = ['subscription_type']

    def __str__(self):
        return f"{self.name} ({self.subscription_type}) - {self.price} руб."


class Subscription(models.Model):
    user = models.ForeignKey(User, related_name="subscriptions", on_delete=models.CASCADE, verbose_name="Пользователь")
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, verbose_name="План")
    start_date = models.DateTimeField(default=now, verbose_name="Дата начала")
    end_date = models.DateTimeField(verbose_name="Дата окончания")

    class Meta:
        verbose_name = "Подписка"
        verbose_name_plural = "Подписки"
        ordering = ['-start_date']

    def save(self, *args, **kwargs):
        if not self.end_date:
            self.end_date = self.start_date + timedelta(days=self.plan.duration_days)
        super().save(*args, **kwargs)

    def is_active(self):
        return self.end_date >= now()

    def __str__(self):
        return f"{self.user.username} - {self.plan.name}"
