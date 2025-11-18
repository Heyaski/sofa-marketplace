# Быстрый старт деплоя на VPS

Краткая инструкция для опытных пользователей. Подробная версия в `DEPLOY_VPS.md`.

## 1. Подготовка сервера

```bash
# Подключение
ssh root@ваш_ip

# Установка зависимостей
sudo bash deploy/install.sh

# Настройка firewall
# Примечание: SQLite используется по умолчанию, настройка БД не требуется
sudo bash deploy/setup-firewall.sh
```

## 2. Загрузка проекта

```bash
# Создание пользователя
adduser deploy
usermod -aG sudo deploy
su - deploy

# Загрузка проекта
mkdir -p ~/sofa-marketplace
cd ~/sofa-marketplace
git clone https://github.com/ваш-репозиторий.git .
```

## 3. Настройка Backend

```bash
cd ~/sofa-marketplace/backend

# Виртуальное окружение
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# .env файл
nano .env
# Добавьте: DJANGO_SECRET, DEBUG=0, ALLOWED_HOSTS
# Примечание: SQLite используется по умолчанию, DATABASE_URL не нужен

# Обновите settings.py (см. PRODUCTION_SETTINGS.md)

# Миграции и статика
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

## 4. Настройка Frontend

```bash
cd ~/sofa-marketplace/frontend

# Зависимости
npm install

# .env.production
nano .env.production
# Добавьте: NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Обновите next.config.js (замените домен)

# Сборка
npm run build
```

## 5. Systemd сервисы

```bash
# Backend
sudo cp deploy/systemd-backend.service.example /etc/systemd/system/sofa-backend.service
sudo nano /etc/systemd/system/sofa-backend.service  # Обновите пути
sudo systemctl daemon-reload
sudo systemctl enable sofa-backend
sudo systemctl start sofa-backend

# Frontend
sudo cp deploy/systemd-frontend.service.example /etc/systemd/system/sofa-frontend.service
sudo nano /etc/systemd/system/sofa-frontend.service  # Обновите пути
sudo systemctl daemon-reload
sudo systemctl enable sofa-frontend
sudo systemctl start sofa-frontend
```

## 6. Nginx

```bash
# Frontend
sudo cp deploy/nginx-frontend.conf.example /etc/nginx/sites-available/sofa-frontend
sudo nano /etc/nginx/sites-available/sofa-frontend  # Замените домен
sudo ln -s /etc/nginx/sites-available/sofa-frontend /etc/nginx/sites-enabled/

# API
sudo cp deploy/nginx-api.conf.example /etc/nginx/sites-available/sofa-api
sudo nano /etc/nginx/sites-available/sofa-api  # Замените домен и пути
sudo ln -s /etc/nginx/sites-available/sofa-api /etc/nginx/sites-enabled/

# Проверка и перезагрузка
sudo nginx -t
sudo systemctl reload nginx
```

## 7. SSL сертификаты

```bash
# Основной домен
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# API поддомен
sudo certbot --nginx -d api.yourdomain.com
```

## 8. DNS настройки

В панели управления доменом добавьте A-записи:

```
@     → IP_вашего_VPS
www   → IP_вашего_VPS
api   → IP_вашего_VPS
```

## Проверка

```bash
# Статус сервисов
sudo systemctl status sofa-backend
sudo systemctl status sofa-frontend
sudo systemctl status nginx

# Логи
sudo journalctl -u sofa-backend -f
sudo journalctl -u sofa-frontend -f
```

## Обновление проекта

```bash
bash deploy/update.sh
```

## Резервное копирование

```bash
bash deploy/backup.sh
```

---

**Готово!** Сайт доступен на `https://yourdomain.com`
