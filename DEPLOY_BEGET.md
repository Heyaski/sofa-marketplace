# Инструкция по деплою на Beget

## Подготовка к деплою

### 1. Подготовка файлов для продакшена

#### Backend (Django)

1. **Создайте файл `.env` в папке `backend/`** с настройками для продакшена:

```env
DJANGO_SECRET=ваш-секретный-ключ-для-продакшена
DEBUG=0
ALLOWED_HOSTS=ваш-домен.ru,www.ваш-домен.ru
DATABASE_URL=postgresql://пользователь:пароль@localhost:5432/имя_базы
```

2. **Обновите `backend/config/settings.py`** для работы с PostgreSQL:

```python
# В settings.py замените секцию DATABASES:
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=get_env('DATABASE_URL', 'sqlite:///db.sqlite3'),
        conn_max_age=600
    )
}

# Добавьте настройки для статики в продакшене:
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'

# Настройки безопасности для продакшена:
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
```

3. **Добавьте в `requirements.txt`**:

```
dj-database-url==2.1.0
gunicorn==21.2.0
whitenoise==6.6.0
```

#### Frontend (Next.js)

1. **Создайте файл `.env.production` в папке `frontend/`**:

```env
NEXT_PUBLIC_API_URL=https://api.ваш-домен.ru
NEXT_PUBLIC_APP_NAME=Sofa Marketplace
```

2. **Обновите `frontend/next.config.js`** для продакшена:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone', // Для оптимизации деплоя
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'api.ваш-домен.ru',
				pathname: '/media/**',
			},
		],
		unoptimized: true,
	},
}

module.exports = nextConfig
```

---

## Деплой на Beget

### Шаг 1: Подключение к серверу

1. Войдите в панель управления Beget
2. Откройте SSH-доступ (если не открыт)
3. Подключитесь через SSH:

```bash
ssh ваш_логин@ваш_сервер.beget.tech
```

### Шаг 2: Подготовка структуры на сервере

```bash
# Создайте структуру директорий
mkdir -p ~/sofa-marketplace/{backend,frontend}
cd ~/sofa-marketplace
```

### Шаг 3: Загрузка файлов на сервер

**Вариант 1: Через Git (рекомендуется)**

```bash
# На сервере
cd ~/sofa-marketplace
git clone https://github.com/ваш-репозиторий.git .

# Или через SSH ключ
git clone git@github.com:ваш-репозиторий.git .
```

**Вариант 2: Через FTP/SFTP**

- Используйте FileZilla или WinSCP
- Загрузите папки `backend/` и `frontend/` в `~/sofa-marketplace/`

### Шаг 4: Настройка базы данных PostgreSQL

1. В панели Beget создайте базу данных PostgreSQL
2. Запишите данные подключения:

   - Хост: `localhost`
   - Порт: `5432`
   - Имя БД: `ваш_логин_имя_бд`
   - Пользователь: `ваш_логин_пользователь`
   - Пароль: `пароль_из_панели`

3. Обновите `.env` файл с этими данными

### Шаг 5: Настройка Django Backend

```bash
cd ~/sofa-marketplace/backend

# Создайте виртуальное окружение Python
python3 -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows

# Установите зависимости
pip install --upgrade pip
pip install -r requirements.txt

# Выполните миграции
python manage.py migrate

# Создайте суперпользователя (если нужно)
python manage.py createsuperuser

# Соберите статику
python manage.py collectstatic --noinput

# Создайте директорию для медиа (если нужно)
mkdir -p media
```

### Шаг 6: Настройка Gunicorn для Django

Создайте файл `~/sofa-marketplace/backend/gunicorn_config.py`:

```python
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
user = "ваш_логин"
group = "ваш_логин"
pidfile = "/home/ваш_логин/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/ваш_логин/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/ваш_логин/sofa-marketplace/backend/logs/error.log"
loglevel = "info"
```

Создайте директорию для логов:

```bash
mkdir -p ~/sofa-marketplace/backend/logs
```

### Шаг 7: Настройка Next.js Frontend

```bash
cd ~/sofa-marketplace/frontend

# Установите Node.js (если не установлен)
# Beget обычно имеет Node.js в менеджере версий

# Установите зависимости
npm install

# Соберите проект для продакшена
npm run build
```

### Шаг 8: Настройка автозапуска через systemd

#### Для Django (Gunicorn)

Создайте файл `~/sofa-marketplace/backend/sofa-backend.service`:

```ini
[Unit]
Description=Sofa Marketplace Django Backend
After=network.target

[Service]
Type=notify
User=ваш_логин
Group=ваш_логин
WorkingDirectory=/home/ваш_логин/sofa-marketplace/backend
Environment="PATH=/home/ваш_логин/sofa-marketplace/backend/venv/bin"
ExecStart=/home/ваш_логин/sofa-marketplace/backend/venv/bin/gunicorn \
    --config gunicorn_config.py \
    config.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Установите сервис:

```bash
sudo cp ~/sofa-marketplace/backend/sofa-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sofa-backend
sudo systemctl start sofa-backend
sudo systemctl status sofa-backend
```

#### Для Next.js

Создайте файл `~/sofa-marketplace/frontend/sofa-frontend.service`:

```ini
[Unit]
Description=Sofa Marketplace Next.js Frontend
After=network.target

[Service]
Type=simple
User=ваш_логин
Group=ваш_логин
WorkingDirectory=/home/ваш_логин/sofa-marketplace/frontend
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node /home/ваш_логин/sofa-marketplace/frontend/node_modules/.bin/next start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Установите сервис:

```bash
sudo cp ~/sofa-marketplace/frontend/sofa-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sofa-frontend
sudo systemctl start sofa-frontend
sudo systemctl status sofa-frontend
```

**Примечание:** На Beget может не быть прав sudo. В этом случае используйте альтернативные методы запуска (см. ниже).

### Шаг 9: Настройка Nginx

В панели Beget создайте два сайта:

1. Основной сайт (фронтенд): `ваш-домен.ru`
2. Поддомен для API: `api.ваш-домен.ru`

#### Конфигурация для фронтенда (`ваш-домен.ru`)

В панели Beget → Сайты → Настройки → Nginx, добавьте:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;

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

#### Конфигурация для API (`api.ваш-домен.ru`)

```nginx
server {
    listen 80;
    server_name api.ваш-домен.ru;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /home/ваш_логин/sofa-marketplace/backend/staticfiles/;
    }

    location /media/ {
        alias /home/ваш_логин/sofa-marketplace/backend/media/;
    }
}
```

### Шаг 10: Настройка SSL (HTTPS)

В панели Beget:

1. Перейдите в раздел SSL
2. Установите бесплатный SSL-сертификат Let's Encrypt для обоих доменов
3. Включите автоматическое перенаправление на HTTPS

### Шаг 11: Альтернативный запуск без systemd (если нет sudo)

Если у вас нет прав sudo, используйте скрипты запуска:

#### `~/sofa-marketplace/backend/start.sh`:

```bash
#!/bin/bash
cd /home/ваш_логин/sofa-marketplace/backend
source venv/bin/activate
gunicorn --config gunicorn_config.py config.wsgi:application
```

#### `~/sofa-marketplace/frontend/start.sh`:

```bash
#!/bin/bash
cd /home/ваш_логин/sofa-marketplace/frontend
export NODE_ENV=production
export PORT=3000
node_modules/.bin/next start
```

Сделайте их исполняемыми:

```bash
chmod +x ~/sofa-marketplace/backend/start.sh
chmod +x ~/sofa-marketplace/frontend/start.sh
```

Запустите через `screen` или `tmux`:

```bash
# Установите screen (если нет)
# На Beget обычно доступен

# Запустите backend
screen -S backend
cd ~/sofa-marketplace/backend
./start.sh
# Нажмите Ctrl+A, затем D для отсоединения

# Запустите frontend
screen -S frontend
cd ~/sofa-marketplace/frontend
./start.sh
# Нажмите Ctrl+A, затем D для отсоединения
```

Для переподключения:

```bash
screen -r backend
screen -r frontend
```

### Шаг 12: Настройка cron для автоматического запуска

Если процессы упадут, настройте cron для автозапуска:

```bash
crontab -e
```

Добавьте:

```cron
# Проверка и перезапуск backend каждые 5 минут
*/5 * * * * pgrep -f "gunicorn.*config.wsgi" || cd /home/ваш_логин/sofa-marketplace/backend && source venv/bin/activate && nohup gunicorn --config gunicorn_config.py config.wsgi:application > /dev/null 2>&1 &

# Проверка и перезапуск frontend каждые 5 минут
*/5 * * * * pgrep -f "next start" || cd /home/ваш_логин/sofa-marketplace/frontend && export NODE_ENV=production && nohup node_modules/.bin/next start > /dev/null 2>&1 &
```

---

## Обновление проекта

### Обновление кода

```bash
cd ~/sofa-marketplace

# Если используете Git
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Перезапуск (если используете systemd)
sudo systemctl restart sofa-backend

# Или если используете screen
screen -r backend
# Ctrl+C для остановки, затем ./start.sh

# Frontend
cd ../frontend
npm install
npm run build

# Перезапуск
sudo systemctl restart sofa-frontend
# Или через screen
screen -r frontend
# Ctrl+C для остановки, затем ./start.sh
```

---

## Проверка работы

1. **Проверьте backend API:**

   ```bash
   curl http://api.ваш-домен.ru/api/
   ```

2. **Проверьте frontend:**

   - Откройте в браузере: `https://ваш-домен.ru`

3. **Проверьте логи:**

   ```bash
   # Backend логи
   tail -f ~/sofa-marketplace/backend/logs/error.log

   # Frontend логи (если настроены)
   journalctl -u sofa-frontend -f
   ```

---

## Решение проблем

### Проблема: Django не запускается

- Проверьте логи: `~/sofa-marketplace/backend/logs/error.log`
- Убедитесь, что виртуальное окружение активировано
- Проверьте права доступа к файлам

### Проблема: Next.js не запускается

- Проверьте, что Node.js установлен: `node --version`
- Убедитесь, что проект собран: `npm run build`
- Проверьте порт 3000: `netstat -tulpn | grep 3000`

### Проблема: 502 Bad Gateway

- Проверьте, что процессы запущены: `ps aux | grep gunicorn` и `ps aux | grep next`
- Проверьте настройки Nginx
- Проверьте, что порты 8000 и 3000 доступны

### Проблема: Статика не загружается

- Выполните `python manage.py collectstatic --noinput`
- Проверьте права доступа к папке `staticfiles`
- Проверьте настройки Nginx для `/static/` и `/media/`

---

## Дополнительные настройки

### Настройка резервного копирования

Создайте скрипт `~/sofa-marketplace/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ваш_логин/backups"

mkdir -p $BACKUP_DIR

# Бэкап базы данных
pg_dump -U ваш_пользователь_бд имя_базы > $BACKUP_DIR/db_$DATE.sql

# Бэкап медиа файлов
tar -czf $BACKUP_DIR/media_$DATE.tar.gz ~/sofa-marketplace/backend/media/

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete
```

Добавьте в cron:

```cron
0 3 * * * /home/ваш_логин/sofa-marketplace/backup.sh
```

---

## Контакты поддержки Beget

Если возникнут проблемы с хостингом:

- Техподдержка: https://beget.com/ru/support
- Документация: https://beget.com/ru/help
