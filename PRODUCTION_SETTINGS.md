# Настройки для продакшена

## Обновление Django settings.py

Добавьте в `backend/config/settings.py` следующие изменения:

### 1. Настройка базы данных SQLite

SQLite уже настроен в `settings.py`. Убедитесь, что конфигурация выглядит так:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
```

**Для продакшена можно указать абсолютный путь (опционально):**

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": "/home/deploy/sofa-marketplace/backend/db.sqlite3",
    }
}
```

> **Примечание:** SQLite отлично подходит для небольших и средних проектов. Для высоконагруженных приложений рекомендуется использовать PostgreSQL.

### 2. Настройки статики для продакшена

Добавьте после `STATIC_URL = "/static/"`:

```python
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'static'
]
```

### 3. Настройки безопасности для продакшена

Добавьте в конец файла:

```python
# Настройки безопасности для продакшена
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
```

### 4. Настройки CORS для продакшена

Замените:

```python
CORS_ALLOW_ALL_ORIGINS = True
```

На:

```python
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        "https://ваш-домен.ru",
        "https://www.ваш-домен.ru",
    ]
```

### 5. Добавление WhiteNoise для статики

В `MIDDLEWARE` добавьте после `SecurityMiddleware`:

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Добавьте эту строку
    # ... остальные middleware
]
```

И добавьте в конец settings.py:

```python
# WhiteNoise для статики
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

## Обновление requirements.txt

Убедитесь, что в `backend/requirements.txt` есть:

```
Django
djangorestframework
django-cors-headers
djangorestframework-simplejwt
django-jazzmin>=3.0.0
gunicorn==21.2.0
whitenoise==6.6.0
```

> **Примечание:** `psycopg2-binary` и `dj-database-url` не нужны для SQLite. SQLite встроен в Python и не требует дополнительных зависимостей.

## Обновление Next.js конфигурации

### next.config.js для продакшена

Обновите `frontend/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone', // Оптимизация для деплоя
	experimental: {
		appDir: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'api.ваш-домен.ru', // Замените на ваш домен API
				pathname: '/media/**',
			},
		],
		unoptimized: true,
	},
}

module.exports = nextConfig
```

## Генерация секретного ключа Django

Для продакшена сгенерируйте новый секретный ключ:

```python
# В Python shell
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

Или через команду:

```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Используйте полученный ключ в `.env` файле.
