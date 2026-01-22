import uuid
from yookassa import Configuration, Payment
from django.conf import settings
from django.utils.timezone import now
from apps.users.models import UserProfile


class YooKassaService:
    """Сервис для работы с ЮКассой"""
    
    def __init__(self):
        # Настройки из settings.py
        self.account_id = getattr(settings, 'YOOKASSA_ACCOUNT_ID', None)
        self.secret_key = getattr(settings, 'YOOKASSA_SECRET_KEY', None)
        self.test_mode = getattr(settings, 'YOOKASSA_TEST_MODE', True)
        
        if self.account_id and self.secret_key:
            Configuration.account_id = self.account_id
            Configuration.secret_key = self.secret_key
    
    def create_subscription_payment(self, user, subscription_type, return_url):
        """
        Создает платеж для подписки
        
        Args:
            user: Пользователь Django
            subscription_type: Тип подписки ('basic' или 'premium')
            return_url: URL для возврата после оплаты
            
        Returns:
            dict: Данные платежа с confirmation_url
        """
        if not self.account_id or not self.secret_key:
            raise ValueError("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY должны быть настроены в settings.py")
        
        # Определяем цену подписки
        prices = {
            'basic': '1000.00',
            'premium': '8000.00',
        }
        
        if subscription_type not in prices:
            raise ValueError(f"Неверный тип подписки: {subscription_type}")
        
        amount = prices[subscription_type]
        
        # Описание подписки
        descriptions = {
            'basic': 'Базовая подписка - 10 скачиваний в месяц',
            'premium': 'Премиум подписка - безлимитное скачивание',
        }
        
        # Создаем платеж
        payment = Payment.create({
            "amount": {
                "value": amount,
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url
            },
            "capture": True,
            "description": descriptions[subscription_type],
            "metadata": {
                "user_id": str(user.id),
                "subscription_type": subscription_type,
                "subscription_duration_days": "30"
            }
        }, uuid.uuid4())
        
        return {
            "payment_id": payment.id,
            "status": payment.status,
            "confirmation_url": payment.confirmation.confirmation_url,
            "amount": payment.amount.value,
            "currency": payment.amount.currency,
        }
    
    def get_payment_status(self, payment_id):
        """
        Получает статус платежа
        
        Args:
            payment_id: ID платежа в ЮКассе
            
        Returns:
            dict: Статус платежа
        """
        if not self.account_id or not self.secret_key:
            raise ValueError("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY должны быть настроены в settings.py")
        
        payment = Payment.find_one(payment_id)
        
        return {
            "payment_id": payment.id,
            "status": payment.status,
            "paid": payment.paid,
            "amount": payment.amount.value,
            "currency": payment.amount.currency,
            "metadata": payment.metadata if hasattr(payment, 'metadata') else {},
        }
    
    def process_successful_payment(self, payment_id):
        """
        Обрабатывает успешный платеж и активирует подписку
        
        Args:
            payment_id: ID платежа в ЮКассе
            
        Returns:
            UserProfile: Обновленный профиль пользователя
        """
        payment_info = self.get_payment_status(payment_id)
        
        if payment_info["status"] != "succeeded" or not payment_info["paid"]:
            raise ValueError(f"Платеж {payment_id} не был успешно оплачен")
        
        metadata = payment_info.get("metadata", {})
        user_id = metadata.get("user_id")
        subscription_type = metadata.get("subscription_type")
        duration_days = int(metadata.get("subscription_duration_days", 30))
        
        if not user_id or not subscription_type:
            raise ValueError("В метаданных платежа отсутствует user_id или subscription_type")
        
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(id=int(user_id))
        except User.DoesNotExist:
            raise ValueError(f"Пользователь с ID {user_id} не найден")
        
        # Получаем или создаем профиль
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={'subscription_type': 'trial'}
        )
        
        # Активируем подписку
        profile.activate_subscription(subscription_type, duration_days)
        profile.yookassa_payment_id = payment_id
        profile.auto_renewal = True  # Включаем автопродление по умолчанию
        profile.save()
        
        return profile

