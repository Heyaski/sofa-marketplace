import uuid
import logging
from yookassa import Configuration, Payment
from django.conf import settings
from django.utils.timezone import now
from apps.users.models import UserProfile

# Настройка логгера для платежей
logger = logging.getLogger('yookassa')


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
        logger.info(f"Создание платежа для пользователя {user.id} ({user.username}), тип подписки: {subscription_type}")
        
        if not self.account_id or not self.secret_key:
            logger.error("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY не настроены")
            raise ValueError("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY должны быть настроены в settings.py")
        
        # Определяем цену подписки
        prices = {
            'basic': '1000.00',
            'premium': '8000.00',
        }
        
        if subscription_type not in prices:
            logger.error(f"Неверный тип подписки: {subscription_type}")
            raise ValueError(f"Неверный тип подписки: {subscription_type}")
        
        amount = prices[subscription_type]
        logger.info(f"Сумма платежа: {amount} RUB")
        
        # Описание подписки
        descriptions = {
            'basic': 'Базовая подписка - 10 скачиваний в месяц',
            'premium': 'Премиум подписка - безлимитное скачивание',
        }
        
        payment_data = {
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
        }
        
        logger.info(f"Отправка запроса в ЮКассу: {payment_data}")
        
        try:
            # Создаем платеж
            payment = Payment.create(payment_data, uuid.uuid4())
            
            logger.info(f"Платеж создан успешно. ID: {payment.id}, статус: {payment.status}")
            
            # Безопасное получение confirmation_url
            confirmation_url = None
            if hasattr(payment, 'confirmation') and payment.confirmation:
                if hasattr(payment.confirmation, 'confirmation_url'):
                    confirmation_url = payment.confirmation.confirmation_url
                elif isinstance(payment.confirmation, dict):
                    confirmation_url = payment.confirmation.get('confirmation_url')
            
            if not confirmation_url:
                logger.error(f"confirmation_url не найден в ответе от ЮКассы. Payment object: {payment}")
                raise ValueError("Не удалось получить URL для оплаты от ЮКассы")
            
            logger.info(f"URL для оплаты: {confirmation_url}")
            
            # Безопасное получение amount
            amount_value = None
            currency_value = "RUB"
            if hasattr(payment, 'amount') and payment.amount:
                if hasattr(payment.amount, 'value'):
                    amount_value = payment.amount.value
                elif isinstance(payment.amount, dict):
                    amount_value = payment.amount.get('value')
                    currency_value = payment.amount.get('currency', 'RUB')
            
            if amount_value is None:
                logger.error(f"amount не найден в ответе от ЮКассы. Payment object: {payment}")
                raise ValueError("Не удалось получить сумму платежа от ЮКассы")
            
            return {
                "payment_id": payment.id,
                "status": payment.status,
                "confirmation_url": confirmation_url,
                "amount": str(amount_value),
                "currency": currency_value,
            }
        except Exception as e:
            logger.error(f"Ошибка при создании платежа: {str(e)}", exc_info=True)
            raise
    
    def get_payment_status(self, payment_id):
        """
        Получает статус платежа
        
        Args:
            payment_id: ID платежа в ЮКассе
            
        Returns:
            dict: Статус платежа
        """
        logger.info(f"Проверка статуса платежа: {payment_id}")
        
        if not self.account_id or not self.secret_key:
            logger.error("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY не настроены")
            raise ValueError("YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY должны быть настроены в settings.py")
        
        try:
            payment = Payment.find_one(payment_id)
            
            logger.info(f"Статус платежа {payment_id}: {payment.status}, оплачен: {payment.paid}")
            
            return {
                "payment_id": payment.id,
                "status": payment.status,
                "paid": payment.paid,
                "amount": payment.amount.value,
                "currency": payment.amount.currency,
                "metadata": payment.metadata if hasattr(payment, 'metadata') else {},
            }
        except Exception as e:
            logger.error(f"Ошибка при получении статуса платежа {payment_id}: {str(e)}", exc_info=True)
            raise
    
    def process_successful_payment(self, payment_id):
        """
        Обрабатывает успешный платеж и активирует подписку
        
        Args:
            payment_id: ID платежа в ЮКассе
            
        Returns:
            UserProfile: Обновленный профиль пользователя
        """
        logger.info(f"Обработка успешного платежа: {payment_id}")
        
        payment_info = self.get_payment_status(payment_id)
        
        if payment_info["status"] != "succeeded" or not payment_info["paid"]:
            logger.warning(f"Платеж {payment_id} не был успешно оплачен. Статус: {payment_info['status']}, оплачен: {payment_info['paid']}")
            raise ValueError(f"Платеж {payment_id} не был успешно оплачен")
        
        metadata = payment_info.get("metadata", {})
        user_id = metadata.get("user_id")
        subscription_type = metadata.get("subscription_type")
        duration_days = int(metadata.get("subscription_duration_days", 30))
        
        logger.info(f"Метаданные платежа: user_id={user_id}, subscription_type={subscription_type}, duration_days={duration_days}")
        
        if not user_id or not subscription_type:
            logger.error(f"В метаданных платежа отсутствует user_id или subscription_type. Метаданные: {metadata}")
            raise ValueError("В метаданных платежа отсутствует user_id или subscription_type")
        
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(id=int(user_id))
            logger.info(f"Найден пользователь: {user.username} (ID: {user.id})")
        except User.DoesNotExist:
            logger.error(f"Пользователь с ID {user_id} не найден")
            raise ValueError(f"Пользователь с ID {user_id} не найден")
        
        # Получаем или создаем профиль
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={'subscription_type': 'trial'}
        )
        
        logger.info(f"Профиль пользователя {'создан' if created else 'найден'}. Текущая подписка: {profile.subscription_type}")
        
        # Активируем подписку
        profile.activate_subscription(subscription_type, duration_days)
        profile.yookassa_payment_id = payment_id
        profile.auto_renewal = True  # Включаем автопродление по умолчанию
        profile.save()
        
        logger.info(f"Подписка активирована: тип={profile.subscription_type}, окончание={profile.subscription_end_date}")
        
        return profile

