# Как посмотреть логи при создании платежа

## 1. Логи Gunicorn (основные логи приложения)

### Просмотр логов ошибок:
```bash
# Последние 50 строк
tail -n 50 ~/sofa-marketplace/backend/logs/error.log

# В реальном времени (следить за новыми записями)
tail -f ~/sofa-marketplace/backend/logs/error.log
```

### Просмотр логов доступа:
```bash
# Последние 50 строк
tail -n 50 ~/sofa-marketplace/backend/logs/access.log

# В реальном времени
tail -f ~/sofa-marketplace/backend/logs/access.log
```

## 2. Логи systemd (логи сервиса)

### Просмотр логов сервиса:
```bash
# Последние 50 строк
sudo journalctl -u sofa-backend.service -n 50 --no-pager

# В реальном времени
sudo journalctl -u sofa-backend.service -f

# Логи за последний час
sudo journalctl -u sofa-backend.service --since "1 hour ago"

# Логи за конкретную дату
sudo journalctl -u sofa-backend.service --since "2026-01-22 00:00:00" --until "2026-01-22 23:59:59"
```

## 3. Фильтрация логов по платежам

### Поиск записей о платежах в логах:
```bash
# В error.log
grep -i "платеж\|payment\|yookassa" ~/sofa-marketplace/backend/logs/error.log

# В systemd логах
sudo journalctl -u sofa-backend.service | grep -i "платеж\|payment\|yookassa"

# Поиск по конкретному payment_id
grep "23d93cac-000f-5000-8000-126628f15141" ~/sofa-marketplace/backend/logs/error.log
```

## 4. Просмотр логов в реальном времени при тестировании

### Откройте два терминала:

**Терминал 1** - следите за логами ошибок:
```bash
tail -f ~/sofa-marketplace/backend/logs/error.log | grep -i "платеж\|payment\|yookassa"
```

**Терминал 2** - следите за systemd логами:
```bash
sudo journalctl -u sofa-backend.service -f | grep -i "платеж\|payment\|yookassa"
```

Теперь при создании платежа вы увидите все логи в реальном времени.

## 5. Что логируется при создании платежа

После добавления логирования в код, вы увидите следующие записи:

1. **Создание платежа:**
   ```
   INFO: Создание платежа для пользователя 1 (username), тип подписки: basic
   INFO: Сумма платежа: 1000.00 RUB
   INFO: Отправка запроса в ЮКассу: {...}
   INFO: Платеж создан успешно. ID: 23d93cac-..., статус: pending
   INFO: URL для оплаты: https://yoomoney.ru/api-pages/...
   ```

2. **Проверка статуса:**
   ```
   INFO: Проверка статуса платежа: 23d93cac-...
   INFO: Статус платежа 23d93cac-...: succeeded, оплачен: True
   ```

3. **Активация подписки:**
   ```
   INFO: Обработка успешного платежа: 23d93cac-...
   INFO: Метаданные платежа: user_id=1, subscription_type=basic, duration_days=30
   INFO: Найден пользователь: username (ID: 1)
   INFO: Профиль пользователя найден. Текущая подписка: trial
   INFO: Подписка активирована: тип=basic, окончание=2026-02-22 03:46:17+00:00
   ```

## 6. Настройка уровня логирования

Если нужно изменить уровень детализации, можно настроить в `settings.py`:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'yookassa_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'yookassa.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'yookassa': {
            'handlers': ['yookassa_file', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

## 7. Быстрая команда для просмотра всех логов платежей

Создайте алиас в `~/.bashrc`:

```bash
alias payment-logs='tail -f ~/sofa-marketplace/backend/logs/error.log | grep -i "платеж\|payment\|yookassa"'
```

Затем:
```bash
source ~/.bashrc
payment-logs
```

## 8. Отладка проблем

Если платеж не создается, проверьте:

1. **Ошибки в логах:**
   ```bash
   tail -n 100 ~/sofa-marketplace/backend/logs/error.log | grep -A 10 -B 10 "ERROR"
   ```

2. **Проверка настроек ЮКассы:**
   ```bash
   # В Django shell
   python manage.py shell
   >>> from django.conf import settings
   >>> print(f"Account ID: {settings.YOOKASSA_ACCOUNT_ID}")
   >>> print(f"Secret Key: {'*' * 20 if settings.YOOKASSA_SECRET_KEY else 'NOT SET'}")
   >>> print(f"Test Mode: {settings.YOOKASSA_TEST_MODE}")
   ```

3. **Тест создания платежа вручную:**
   ```bash
   python manage.py shell
   >>> from services.yookassa_service import YooKassaService
   >>> from django.contrib.auth.models import User
   >>> user = User.objects.first()
   >>> service = YooKassaService()
   >>> payment = service.create_subscription_payment(user, 'basic', 'https://example.com/return')
   ```

