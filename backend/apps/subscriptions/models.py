from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils.timezone import now


class Plan(models.Model):
    name = models.CharField(max_length=100, verbose_name="Название")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена")
    duration_days = models.PositiveIntegerField(default=30, verbose_name="Длительность (дней)")

    class Meta:
        verbose_name = "План подписки"
        verbose_name_plural = "Планы подписок"

    def __str__(self):
        return self.name


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
