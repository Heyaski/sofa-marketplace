# Исправление ошибки запуска sofa-backend

## Диагностика проблемы

Выполните следующие команды для диагностики:

```bash
# 1. Проверьте логи ошибки
sudo journalctl -xeu sofa-backend.service -n 50

# 2. Или более подробно
sudo journalctl -u sofa-backend.service --no-pager -n 100
```

## Решение проблемы

### Шаг 1: Установка WhiteNoise

Скорее всего проблема в том, что WhiteNoise не установлен. Установите его:

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate

# Установите WhiteNoise
pip install whitenoise==6.6.0

# Или установите все зависимости заново
pip install -r requirements.txt
```

### Шаг 2: Проверка установки

```bash
# Проверьте, что WhiteNoise установлен
pip list | grep whitenoise

# Проверьте конфигурацию Django
python manage.py check
```

### Шаг 3: Если проблема в STATICFILES_STORAGE

Если ошибка связана с `CompressedManifestStaticFilesStorage`, попробуйте временно изменить настройку:

Отредактируйте `backend/config/settings.py`:

```python
# Вместо:
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Используйте:
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
```

Или вообще уберите эту строку, если используете Nginx для статики:

```python
# Закомментируйте или удалите:
# STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### Шаг 4: Сбор статики (если нужно)

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate

# Соберите статику
python manage.py collectstatic --noinput
```

### Шаг 5: Перезапуск сервиса

```bash
sudo systemctl restart sofa-backend
sudo systemctl status sofa-backend
```

## Альтернативное решение (если WhiteNoise вызывает проблемы)

Если WhiteNoise продолжает вызывать проблемы, можно временно отключить его и использовать только Nginx для статики:

### 1. Отредактируйте settings.py

```bash
nano ~/sofa-marketplace/backend/config/settings.py
```

### 2. Закомментируйте WhiteNoise middleware

Найдите строку:

```python
"whitenoise.middleware.WhiteNoiseMiddleware",  # Для обслуживания статики в продакшене
```

И закомментируйте её:

```python
# "whitenoise.middleware.WhiteNoiseMiddleware",  # Для обслуживания статики в продакшене
```

### 3. Закомментируйте STATICFILES_STORAGE

Найдите:

```python
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

И закомментируйте:

```python
# STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### 4. Убедитесь, что Nginx правильно настроен

Проверьте конфигурацию `/etc/nginx/sites-available/sofa-api`:

```nginx
location /static/ {
    alias /home/deploy/sofa-marketplace/backend/staticfiles/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 5. Перезапустите сервисы

```bash
sudo systemctl restart sofa-backend
sudo systemctl reload nginx
```

## Быстрое решение (все команды сразу)

```bash
cd ~/sofa-marketplace/backend && \
source venv/bin/activate && \
pip install whitenoise==6.6.0 && \
python manage.py collectstatic --noinput && \
sudo systemctl restart sofa-backend && \
sudo systemctl status sofa-backend
```

## Если проблема не решена

Выполните и пришлите вывод:

```bash
# 1. Полные логи ошибки
sudo journalctl -u sofa-backend.service --no-pager -n 200

# 2. Проверка конфигурации Django
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py check --deploy

# 3. Проверка установленных пакетов
pip list

# 4. Проверка синтаксиса settings.py
python -c "import django; django.setup(); from config import settings; print('OK')"
```
