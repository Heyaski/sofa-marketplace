# Инструкция по деплою на VPS сервер

Полная инструкция по развертыванию Django + Next.js приложения на VPS сервере с привязкой домена.

---

## Предварительные требования

- VPS сервер с Ubuntu 20.04/22.04 или Debian 11/12
- Root доступ к серверу
- Доменное имя (например, `yourdomain.com`)
- Доступ к настройкам DNS вашего домена

---

## Шаг 1: Подключение к серверу и базовая настройка

### 1.1 Подключение по SSH

```bash
ssh root@ваш_ip_адрес
# или
ssh root@yourdomain.com
```

### 1.2 Обновление системы

```bash
apt update && apt upgrade -y
```

### 1.3 Создание пользователя для приложения (рекомендуется)

```bash
# Создаем пользователя
adduser deploy
usermod -aG sudo deploy

# Переключаемся на нового пользователя
su - deploy
```

---

## Шаг 2: Установка необходимого ПО

### 2.1 Установка Python и pip

```bash
sudo apt install -y python3 python3-pip python3-venv python3-dev
sudo apt install -y build-essential
```

### 2.2 Установка Node.js и npm

```bash
# Установка Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версий
node --version
npm --version
```

### 2.3 Установка Nginx

```bash
sudo apt install -y nginx

# Запуск и автозапуск Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 Установка Certbot (для SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2.5 Установка Git

```bash
sudo apt install -y git
```

---

## Шаг 3: Настройка DNS и привязка домена

> **Примечание:** В этом проекте используется SQLite (встроенная база данных Django), поэтому настройка отдельной БД не требуется. SQLite создаст файл `db.sqlite3` автоматически при первом запуске миграций.

### 4.1 Настройка DNS записей

В панели управления вашего домена (у регистратора) добавьте следующие A-записи:

```
Тип: A
Имя: @
Значение: IP_адрес_вашего_VPS
TTL: 3600

Тип: A
Имя: www
Значение: IP_адрес_вашего_VPS
TTL: 3600

Тип: A
Имя: api
Значение: IP_адрес_вашего_VPS
TTL: 3600
```

**Пример:**

- `yourdomain.com` → `185.123.45.67`
- `www.yourdomain.com` → `185.123.45.67`
- `api.yourdomain.com` → `185.123.45.67`

### 4.2 Проверка DNS

Дождитесь распространения DNS (обычно 5-30 минут), затем проверьте:

```bash
# На вашем локальном компьютере
nslookup yourdomain.com
nslookup api.yourdomain.com
```

---

## Шаг 5: Настройка Firewall

### 5.1 Настройка UFW (Uncomplicated Firewall)

```bash
# Разрешаем SSH
sudo ufw allow OpenSSH

# Разрешаем HTTP и HTTPS
sudo ufw allow 'Nginx Full'

# Включаем firewall
sudo ufw enable

# Проверяем статус
sudo ufw status
```

---

## Шаг 6: Загрузка проекта на сервер

### 6.1 Создание структуры директорий

```bash
# Создаем директорию для проекта
mkdir -p ~/sofa-marketplace
cd ~/sofa-marketplace
```

### 6.2 Загрузка через Git (рекомендуется)

```bash
# Если проект в Git репозитории
git clone https://github.com/ваш-репозиторий/sofa-marketplace.git .

# Или через SSH ключ
git clone git@github.com:ваш-репозиторий/sofa-marketplace.git .
```

**Настройка SSH ключа на сервере (если нужно):**

```bash
# Генерируем SSH ключ
ssh-keygen -t ed25519 -C "deploy@yourdomain.com"

# Показываем публичный ключ
cat ~/.ssh/id_ed25519.pub
# Добавьте этот ключ в настройки GitHub/GitLab
```

### 6.3 Альтернатива: Загрузка через SCP/SFTP

С вашего локального компьютера:

```bash
# Загрузка всего проекта
scp -r /путь/к/проекту/sofa-marketplace deploy@yourdomain.com:~/sofa-marketplace
```

---

## Шаг 7: Настройка Django Backend

### 7.1 Создание виртуального окружения

```bash
cd ~/sofa-marketplace/backend
python3 -m venv venv
source venv/bin/activate
```

### 7.2 Установка зависимостей

```bash
# Обновляем pip
pip install --upgrade pip

# Устанавливаем зависимости
pip install -r requirements.txt

# Убедитесь, что в requirements.txt есть:
# - Django
# - djangorestframework
# - django-cors-headers
# - djangorestframework-simplejwt
# - django-jazzmin
# - gunicorn==21.2.0
# - whitenoise==6.6.0
#
# Примечание: psycopg2-binary и dj-database-url не нужны для SQLite
```

### 7.3 Создание файла .env

```bash
nano ~/sofa-marketplace/backend/.env
```

Добавьте содержимое:

```env
DJANGO_SECRET=сгенерируйте-новый-секретный-ключ-для-продакшена
DEBUG=0
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com
```

**Генерация секретного ключа:**

```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 7.4 Обновление settings.py для продакшена

Отредактируйте `backend/config/settings.py`:

```bash
nano ~/sofa-marketplace/backend/config/settings.py
```

**SQLite уже настроен в settings.py. Убедитесь, что конфигурация БД выглядит так:**

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

**Добавьте настройки статики:**

```python
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

**Добавьте WhiteNoise в MIDDLEWARE (после SecurityMiddleware):**

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Добавьте эту строку
    # ... остальные
]
```

**Добавьте в конец файла:**

```python
# WhiteNoise для статики
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

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

# CORS настройки для продакшена
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        "https://yourdomain.com",
        "https://www.yourdomain.com",
    ]
```

### 7.5 Выполнение миграций

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py migrate
```

### 7.6 Создание суперпользователя

```bash
python manage.py createsuperuser
```

### 7.7 Сбор статики

```bash
python manage.py collectstatic --noinput
```

### 7.8 Создание директории для логов

```bash
mkdir -p ~/sofa-marketplace/backend/logs
```

---

## Шаг 8: Настройка Gunicorn

### 8.1 Создание конфигурационного файла Gunicorn

```bash
nano ~/sofa-marketplace/backend/gunicorn_config.py
```

Добавьте:

```python
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
user = "deploy"
group = "deploy"
pidfile = "/home/deploy/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/deploy/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
loglevel = "info"
```

### 8.2 Создание systemd сервиса для Django

```bash
sudo nano /etc/systemd/system/sofa-backend.service
```

Добавьте:

```ini
[Unit]
Description=Sofa Marketplace Django Backend
After=network.target

[Service]
Type=notify
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/sofa-marketplace/backend
Environment="PATH=/home/deploy/sofa-marketplace/backend/venv/bin"
ExecStart=/home/deploy/sofa-marketplace/backend/venv/bin/gunicorn \
    --config gunicorn_config.py \
    config.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8.3 Запуск сервиса

```bash
sudo systemctl daemon-reload
sudo systemctl enable sofa-backend
sudo systemctl start sofa-backend
sudo systemctl status sofa-backend
```

---

## Шаг 9: Настройка Next.js Frontend

### 9.1 Установка зависимостей

```bash
cd ~/sofa-marketplace/frontend
npm install
```

### 9.2 Создание файла .env.production

```bash
nano ~/sofa-marketplace/frontend/.env.production
```

Добавьте:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_NAME=Sofa Marketplace
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 9.3 Обновление next.config.js

```bash
nano ~/sofa-marketplace/frontend/next.config.js
```

Обновите:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	experimental: {
		appDir: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'api.yourdomain.com', // Замените на ваш домен
				pathname: '/media/**',
			},
		],
		unoptimized: true,
	},
}

module.exports = nextConfig
```

### 9.4 Сборка проекта

```bash
npm run build
```

### 9.5 Создание systemd сервиса для Next.js

```bash
sudo nano /etc/systemd/system/sofa-frontend.service
```

Добавьте:

```ini
[Unit]
Description=Sofa Marketplace Next.js Frontend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/sofa-marketplace/frontend
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node /home/deploy/sofa-marketplace/frontend/node_modules/.bin/next start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 9.6 Запуск сервиса

```bash
sudo systemctl daemon-reload
sudo systemctl enable sofa-frontend
sudo systemctl start sofa-frontend
sudo systemctl status sofa-frontend
```

---

## Шаг 10: Настройка Nginx

### 10.1 Конфигурация для фронтенда (основной домен)

```bash
sudo nano /etc/nginx/sites-available/sofa-frontend
```

Добавьте:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 10.2 Конфигурация для API (поддомен)

```bash
sudo nano /etc/nginx/sites-available/sofa-api
```

Добавьте:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /home/deploy/sofa-marketplace/backend/staticfiles/;
    }

    location /media/ {
        alias /home/deploy/sofa-marketplace/backend/media/;
    }
}
```

### 10.3 Активация конфигураций

```bash
# Создаем символические ссылки
sudo ln -s /etc/nginx/sites-available/sofa-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/sofa-api /etc/nginx/sites-enabled/

# Удаляем дефолтную конфигурацию (если нужно)
sudo rm /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
sudo nginx -t

# Перезагружаем Nginx
sudo systemctl reload nginx
```

---

## Шаг 11: Настройка SSL (HTTPS) через Let's Encrypt

### 11.1 Получение SSL сертификатов

```bash
# Для основного домена
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Для API поддомена
sudo certbot --nginx -d api.yourdomain.com
```

Certbot автоматически обновит конфигурации Nginx для использования HTTPS.

### 11.2 Автоматическое обновление сертификатов

Certbot автоматически создает cron задачу для обновления сертификатов. Проверить можно:

```bash
sudo certbot renew --dry-run
```

---

## Шаг 12: Финальная проверка

### 12.1 Проверка статуса сервисов

```bash
# Проверка Django
sudo systemctl status sofa-backend

# Проверка Next.js
sudo systemctl status sofa-frontend

# Проверка Nginx
sudo systemctl status nginx

# Проверка PostgreSQL
sudo systemctl status postgresql
```

### 12.2 Проверка логов

```bash
# Логи Django
tail -f /home/deploy/sofa-marketplace/backend/logs/error.log

# Логи Next.js
sudo journalctl -u sofa-frontend -f

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
```

### 12.3 Проверка работы сайта

1. Откройте в браузере: `https://yourdomain.com`
2. Проверьте API: `https://api.yourdomain.com/api/`
3. Проверьте админ-панель: `https://api.yourdomain.com/admin/`

---

## Обновление проекта

### Обновление кода

```bash
cd ~/sofa-marketplace

# Обновляем код
git pull origin main  # или ваша ветка

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart sofa-backend

# Frontend
cd ../frontend
npm install
npm run build
sudo systemctl restart sofa-frontend
```

---

## Резервное копирование

### Создание скрипта бэкапа

```bash
nano ~/backup.sh
```

Добавьте:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"

mkdir -p $BACKUP_DIR

# Бэкап базы данных SQLite
cp ~/sofa-marketplace/backend/db.sqlite3 $BACKUP_DIR/db_$DATE.sqlite3

# Бэкап медиа файлов
tar -czf $BACKUP_DIR/media_$DATE.tar.gz ~/sofa-marketplace/backend/media/

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Сделайте исполняемым:

```bash
chmod +x ~/backup.sh
```

### Настройка автоматического бэкапа

```bash
crontab -e
```

Добавьте (бэкап каждый день в 3:00):

```cron
0 3 * * * /home/deploy/backup.sh >> /home/deploy/backup.log 2>&1
```

---

## Решение проблем

### Проблема: Django не запускается

```bash
# Проверьте логи
sudo journalctl -u sofa-backend -n 50

# Проверьте конфигурацию
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py check
```

### Проблема: Next.js не запускается

```bash
# Проверьте логи
sudo journalctl -u sofa-frontend -n 50

# Проверьте, что порт 3000 свободен
sudo netstat -tulpn | grep 3000
```

### Проблема: 502 Bad Gateway

```bash
# Проверьте, что сервисы запущены
sudo systemctl status sofa-backend
sudo systemctl status sofa-frontend

# Проверьте порты
sudo netstat -tulpn | grep 8000
sudo netstat -tulpn | grep 3000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log
```

### Проблема: Статика не загружается

```bash
# Пересоберите статику
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py collectstatic --noinput --clear

# Проверьте права доступа
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
```

### Проблема: Ошибки с базой данных SQLite

```bash
# Проверьте права доступа к файлу БД
ls -la ~/sofa-marketplace/backend/db.sqlite3

# Убедитесь, что у пользователя deploy есть права на запись
sudo chown deploy:deploy ~/sofa-marketplace/backend/db.sqlite3
sudo chmod 664 ~/sofa-marketplace/backend/db.sqlite3

# Проверьте, что директория существует и доступна для записи
ls -la ~/sofa-marketplace/backend/
```

---

## Полезные команды

```bash
# Перезапуск всех сервисов
sudo systemctl restart sofa-backend sofa-frontend nginx

# Просмотр логов в реальном времени
sudo journalctl -u sofa-backend -f
sudo journalctl -u sofa-frontend -f

# Проверка использования ресурсов
htop
df -h
free -h

# Проверка открытых портов
sudo netstat -tulpn
```

---

## Безопасность

### Дополнительные меры безопасности

1. **Отключение root входа по SSH:**

```bash
sudo nano /etc/ssh/sshd_config
# Установите: PermitRootLogin no
sudo systemctl restart sshd
```

2. **Настройка fail2ban:**

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

3. **Регулярные обновления:**

```bash
# Добавьте в crontab
0 2 * * 0 apt update && apt upgrade -y
```

---

## Контакты и поддержка

Если возникли проблемы:

- Проверьте логи сервисов
- Убедитесь, что все порты открыты
- Проверьте настройки DNS
- Убедитесь, что SSL сертификаты действительны

---

**Готово!** Ваш сайт должен быть доступен по адресу `https://yourdomain.com`
