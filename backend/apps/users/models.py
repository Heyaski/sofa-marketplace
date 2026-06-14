from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now
from datetime import timedelta


class UserProfile(models.Model):
    """Расширенный профиль пользователя"""
    
    SUBSCRIPTION_CHOICES = [
        ('free', 'Free'),
        ('trial', 'Trial'),
        ('basic', 'Базовый'),
        ('pro', 'Pro'),
        ('premium', 'Pro (legacy)'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    # Подписка
    subscription_type = models.CharField(
        max_length=10,
        choices=SUBSCRIPTION_CHOICES,
        default='free',
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
    avatar = models.ImageField(
        upload_to='avatars/',
        blank=True,
        null=True,
        verbose_name='Аватар'
    )
    
    # Ключ лицензии для плагина (хеш, хранится в БД; отображается пользователю для копирования)
    license_key_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        verbose_name='Хеш ключа лицензии',
        help_text='SHA256 хеш ключа. Генерируется при активации подписки. Показывается пользователю в профиле.'
    )
    plugin_offline_models_path = models.CharField(
        max_length=512,
        blank=True,
        default='',
        verbose_name='Папка моделей для плагина (офлайн)',
        help_text='Локальная папка на ПК (D:\\Models). Плагин ищет GLB/RFA здесь до скачивания из облака.',
    )
    PLUGIN_STORAGE_CHOICES = [
        ('vizhub_cloud', 'Только облако VizHub'),
        ('local_first', 'Сначала локально, затем облако'),
        ('local_only', 'Только локальная папка'),
    ]
    plugin_storage_backend = models.CharField(
        max_length=32,
        choices=PLUGIN_STORAGE_CHOICES,
        default='local_first',
        verbose_name='Источник файлов для плагина',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def get_download_limit(self):
        """Возвращает лимит скачиваний в зависимости от типа подписки"""
        limits = {
            'free': 5,        # 5 моделей сразу + 5 каждые 7 дней
            'trial': 100,     # 14 дней, 100 скачиваний всего
            'basic': None,    # без ограничений
            'pro': None,      # без ограничений
            'premium': None,  # legacy → без ограничений
        }
        return limits.get(self.subscription_type, 5)
    
    def can_download(self, current_downloads_count):
        """Проверяет, может ли пользователь скачать еще модели"""
        # Проверяем и обновляем статус подписки, если нужно
        self.check_and_update_subscription_status()
        
        limit = self.get_download_limit()
        if limit is None:  # Премиум - без ограничений
            return True
        return current_downloads_count < limit
    
    def check_and_update_subscription_status(self):
        """
        Проверяет статус подписки и автоматически переключает на пробную, если подписка истекла
        """
        # Free не имеет срока
        if self.subscription_type == 'free':
            return True
        
        # Trial истекает через 14 дней
        if self.subscription_type == 'trial':
            if self.subscription_end_date and now() > self.subscription_end_date:
                self.subscription_type = 'free'
                self.subscription_start_date = None
                self.subscription_end_date = None
                self.save()
                return False
            return True
        
        # Проверяем, не истекла ли платная подписка
        if self.subscription_end_date and now() > self.subscription_end_date:
            # Подписка истекла, возвращаем к Free
            self.subscription_type = 'free'
            self.subscription_start_date = None
            self.subscription_end_date = None
            self.auto_renewal = False
            self.yookassa_payment_id = None
            self.save()
            return False
        
        return True
    
    def is_subscription_active(self):
        """Проверяет, активна ли подписка (с автоматическим обновлением статуса)"""
        # Сначала проверяем и обновляем статус, если нужно
        is_active = self.check_and_update_subscription_status()
        return is_active
    
    def ensure_license_key_hash(self):
        """Генерирует license_key_hash если его нет (только при оплате подписки: basic, pro, premium)."""
        if self.license_key_hash:
            return False
        if self.subscription_type not in ('basic', 'pro', 'premium'):
            return False
        import hashlib
        import secrets
        plain_key = secrets.token_hex(32)
        self.license_key_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        return True

    def activate_subscription(self, subscription_type, duration_days=30):
        """Активирует подписку на указанное количество дней"""
        self.subscription_type = subscription_type
        self.subscription_start_date = now()
        self.subscription_end_date = now() + timedelta(days=duration_days)
        self.ensure_license_key_hash()
        self.save()
        if subscription_type in ('basic', 'pro', 'premium'):
            from apps.plugin.connection import send_plugin_activation_email
            send_plugin_activation_email(self)
    
    def __str__(self):
        return f"Профиль {self.user.username}"
    
    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

