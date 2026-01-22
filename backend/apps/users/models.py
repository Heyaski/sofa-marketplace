from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now
from datetime import timedelta


class UserProfile(models.Model):
    """Расширенный профиль пользователя"""
    
    SUBSCRIPTION_CHOICES = [
        ('trial', 'Пробная'),
        ('basic', 'Базовая'),
        ('premium', 'Премиум'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    # Подписка
    subscription_type = models.CharField(
        max_length=10,
        choices=SUBSCRIPTION_CHOICES,
        default='trial',
        verbose_name='Тип подписки'
    )
    
    # Дата начала подписки
    subscription_start_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Дата начала подписки',
        help_text='Дата начала активной подписки'
    )
    
    # Дата окончания подписки
    subscription_end_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Дата окончания подписки',
        help_text='Дата окончания активной подписки'
    )
    
    # Автопродление подписки
    auto_renewal = models.BooleanField(
        default=False,
        verbose_name='Автопродление подписки'
    )
    
    # ID платежа ЮКассы для автопродления (если используется)
    yookassa_payment_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='ID платежа ЮКассы'
    )
    
    # Данные карты
    card_number = models.CharField(max_length=19, blank=True, default='')
    card_holder = models.CharField(max_length=255, blank=True, default='')
    card_expiry = models.CharField(max_length=7, blank=True, default='')  # MM / YY
    card_cvv = models.CharField(max_length=3, blank=True, default='')
    
    # Настройки уведомлений
    chat_notifications = models.BooleanField(default=True)
    new_models_notifications = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def get_download_limit(self):
        """Возвращает лимит скачиваний в зависимости от типа подписки"""
        limits = {
            'trial': 3,      # Пробная: 3 модели
            'basic': 10,     # Базовая: 10 моделей
            'premium': None, # Премиум: без ограничений (None = безлимит)
        }
        return limits.get(self.subscription_type, 3)
    
    def can_download(self, current_downloads_count):
        """Проверяет, может ли пользователь скачать еще модели"""
        # Проверяем, не истекла ли подписка
        if self.subscription_type != 'trial' and self.subscription_end_date:
            if now() > self.subscription_end_date:
                # Подписка истекла, возвращаем к пробной
                self.subscription_type = 'trial'
                self.subscription_end_date = None
                self.auto_renewal = False
                self.save()
        
        limit = self.get_download_limit()
        if limit is None:  # Премиум - без ограничений
            return True
        return current_downloads_count < limit
    
    def is_subscription_active(self):
        """Проверяет, активна ли подписка"""
        if self.subscription_type == 'trial':
            return True  # Пробная подписка всегда активна
        if self.subscription_end_date:
            return now() <= self.subscription_end_date
        return False
    
    def activate_subscription(self, subscription_type, duration_days=30):
        """Активирует подписку на указанное количество дней"""
        self.subscription_type = subscription_type
        self.subscription_start_date = now()
        self.subscription_end_date = now() + timedelta(days=duration_days)
        self.save()
    
    def __str__(self):
        return f"Профиль {self.user.username}"
    
    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

