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
        
        # Получаем email пользователя для чека
        customer_email = user.email if user.email else None
        if not customer_email:
            logger.warning(f"У пользователя {user.id} ({user.username}) не указан email. Чек будет создан без данных покупателя.")
        
        # Формируем структуру чека
        receipt_data = {
            "items": [
                {
                    "description": descriptions[subscription_type],
                    "quantity": "1.00",
                    "amount": {
                        "value": amount,
                        "currency": "RUB"
                    },
                    "vat_code": 1,  # НДС 20%
                    "payment_subject": "service",  # Признак предмета расчета: услуга
                    "payment_method": "full_payment",  # Признак способа расчета: полный расчет
                    "payment_mode": "full_payment"  # Признак способа расчета (для онлайн-кассы)
                }
            ]
        }
        
        # Добавляем данные покупателя, если email указан
        if customer_email:
            receipt_data["customer"] = {
                "email": customer_email
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
            },
            "receipt": receipt_data
        }
        
        logger.info(f"Отправка запроса в ЮКассу: {payment_data}")
        
        try:
            # Проверяем, что Configuration настроена
            if not Configuration.account_id or not Configuration.secret_key:
                error_msg = "Configuration ЮКассы не настроена. Проверьте YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # Убеждаемся, что сумма в правильном формате (строка с двумя знаками после запятой)
            if isinstance(amount, (int, float)):
                amount = f"{amount:.2f}"
            elif not isinstance(amount, str):
                amount = str(amount)
            
            # Обновляем payment_data с правильным форматом суммы
            payment_data["amount"]["value"] = amount
            
            # Проверяем return_url
            if not return_url or not return_url.startswith(('http://', 'https://')):
                error_msg = f"Некорректный return_url: {return_url}. URL должен начинаться с http:// или https://"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            logger.info(f"Отправка запроса в ЮКассу: {payment_data}")
            
            # Детальное логирование Configuration (без секретного ключа)
            config_info = {
                'account_id': Configuration.account_id[:10] + '...' if Configuration.account_id else 'NOT SET',
                'secret_key_set': 'YES' if Configuration.secret_key else 'NO',
                'secret_key_length': len(Configuration.secret_key) if Configuration.secret_key else 0,
                'test_mode': self.test_mode
            }
            logger.info(f"Configuration ЮКассы: {config_info}")
            
            # Проверяем, что Configuration правильно настроена
            if not Configuration.account_id:
                raise ValueError("Configuration.account_id не установлен. Проверьте YOOKASSA_ACCOUNT_ID")
            if not Configuration.secret_key:
                raise ValueError("Configuration.secret_key не установлен. Проверьте YOOKASSA_SECRET_KEY")
            
            # Создаем платеж
            idempotence_key = uuid.uuid4()
            logger.info(f"Idempotence key: {idempotence_key}")
            
            payment = Payment.create(payment_data, idempotence_key)
            
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
            # Пытаемся извлечь детальную информацию об ошибке
            error_details = str(e)
            error_type = type(e).__name__
            
            # Для HTTPError от requests нужно извлечь детали из response
            if hasattr(e, 'response') and e.response:
                try:
                    # Логируем статус код
                    status_code = getattr(e.response, 'status_code', None)
                    if status_code:
                        error_details = f"HTTP {status_code}: {error_details}"
                    
                    # Пытаемся получить содержимое ответа разными способами
                    response_content = None
                    response_text = None
                    
                    # Способ 1: response.content (байты)
                    if hasattr(e.response, 'content'):
                        try:
                            response_content = e.response.content
                            if response_content:
                                # Пытаемся декодировать как UTF-8
                                try:
                                    response_text = response_content.decode('utf-8')
                                    logger.error(f"Содержимое ответа (content): {response_text}")
                                except UnicodeDecodeError:
                                    logger.error(f"Содержимое ответа (content, raw): {response_content}")
                        except Exception as content_error:
                            logger.warning(f"Не удалось получить content: {content_error}")
                    
                    # Способ 2: response.text
                    if not response_text and hasattr(e.response, 'text'):
                        try:
                            response_text = e.response.text
                            if response_text:
                                logger.error(f"Содержимое ответа (text): {response_text}")
                        except Exception as text_error:
                            logger.warning(f"Не удалось получить text: {text_error}")
                    
                    # Пытаемся распарсить как JSON
                    if response_text:
                        try:
                            import json
                            error_json = json.loads(response_text)
                            if isinstance(error_json, dict):
                                # Извлекаем детали из JSON ответа ЮКассы
                                yookassa_error_details = []
                                if 'type' in error_json:
                                    yookassa_error_details.append(f"Тип: {error_json.get('type')}")
                                if 'description' in error_json:
                                    yookassa_error_details.append(f"Описание: {error_json.get('description')}")
                                if 'parameter' in error_json:
                                    yookassa_error_details.append(f"Параметр: {error_json.get('parameter')}")
                                if 'retry_after' in error_json:
                                    yookassa_error_details.append(f"Повторить через: {error_json.get('retry_after')}")
                                
                                # Добавляем все остальные поля
                                other_fields = {k: v for k, v in error_json.items() 
                                              if k not in ['type', 'description', 'parameter', 'retry_after']}
                                if other_fields:
                                    yookassa_error_details.append(f"Дополнительно: {other_fields}")
                                
                                if yookassa_error_details:
                                    error_details = f"{error_details}. Детали от ЮКассы: {'; '.join(yookassa_error_details)}"
                                else:
                                    error_details = f"{error_details}. Полный ответ: {error_json}"
                            else:
                                error_details = f"{error_details}. JSON ответ: {error_json}"
                        except (ValueError, json.JSONDecodeError):
                            # Если не JSON, используем текст как есть
                            error_details = f"{error_details}. Текст ответа: {response_text}"
                    
                    # Логируем заголовки ответа для отладки
                    if hasattr(e.response, 'headers'):
                        logger.error(f"Заголовки ответа: {dict(e.response.headers)}")
                    
                except Exception as parse_error:
                    logger.warning(f"Не удалось распарсить ответ об ошибке: {parse_error}", exc_info=True)
            
            # Проверяем атрибуты исключения
            if hasattr(e, 'code'):
                error_details = f"{error_details}. Код: {e.code}"
            if hasattr(e, 'description'):
                error_details = f"{error_details}. Описание: {e.description}"
            if hasattr(e, 'message'):
                error_details = f"{error_details}. Сообщение: {e.message}"
            
            # Логируем полную информацию об ошибке, включая payment_data для отладки
            logger.error(f"Ошибка при создании платежа (тип: {error_type}): {error_details}")
            logger.error(f"Данные запроса, которые вызвали ошибку: {payment_data}")
            logger.error(f"Полный traceback:", exc_info=True)
            
            # Формируем понятное сообщение для пользователя
            if "400" in error_details or "Bad Request" in error_details:
                user_message = f"Некорректный запрос к ЮКассе. Проверьте настройки платежной системы. Детали: {error_details}"
            elif "401" in error_details or "Unauthorized" in error_details:
                user_message = f"Ошибка авторизации в ЮКассе. Проверьте YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY. Детали: {error_details}"
            elif "403" in error_details or "Forbidden" in error_details:
                user_message = f"Доступ запрещен в ЮКассе. Проверьте права доступа. Детали: {error_details}"
            else:
                user_message = f"Ошибка при создании платежа в ЮКассе: {error_details}"
            
            raise ValueError(user_message)
    
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

