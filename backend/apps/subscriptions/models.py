from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils.timezone import now


class Plan(models.Model):
    SUBSCRIPTION_TYPE_CHOICES = [
        ('free', 'Free'),
        ('trial', 'Trial'),
        ('basic', 'Базовый'),
        ('pro', 'Pro'),
        # Для обратной совместимости с платёжками
        ('premium', 'Pro (legacy)'),
    ]
    
    name = models.CharField(max_length=100, verbose_name="Название")
    subscription_type = models.CharField(
        max_length=10,
        choices=SUBSCRIPTION_TYPE_CHOICES,
        unique=True,
        blank=True,
        null=True,
        verbose_name="Тип подписки",
        help_text="free, trial, basic, pro"
    )
    # Цены
    price = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=0,
        verbose_name="Цена помесячно (руб.)"
    )
    price_yearly = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Цена за год (руб.)",
        help_text="Сумма к оплате за год. Пусто — годовой тариф недоступен."
    )
    price_yearly_per_month = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Цена за год в пересчёте на месяц (руб.)"
    )
    duration_days = models.PositiveIntegerField(default=30, verbose_name="Длительность (дней)")
    description = models.TextField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Описание",
        help_text="Описание подписки для чека"
    )
    # Доступ по тарифу (тексты для таблицы)
    revit_access = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Доступ к Revit-моделям"
    )
    script_access = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Доступ к скрипту замены"
    )
    highpoly_access = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Доступ к high-poly"
    )
    limits = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name="Лимиты и особенности"
    )
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок в таблице")

    class Meta:
        verbose_name = "План подписки"
        verbose_name_plural = "Планы подписок"
        ordering = ['order', 'subscription_type']

    def __str__(self):
        subscription_type_str = self.subscription_type or 'не указан'
        return f"{self.name} ({subscription_type_str}) - {self.price} руб."


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
