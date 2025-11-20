# Исправление проблем на продакшене

## Проблемы

1. Картинки с базы данных не отображаются
2. Админ панель без стилей

## Решение

### Шаг 1: Обновление кода на сервере

```bash
cd ~/sofa-marketplace

# Обновляем код (если используете git)
git pull origin main  # или ваша ветка

# Или загрузите обновленные файлы через SCP/SFTP
```

### Шаг 2: Обновление зависимостей Backend

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate

# Устанавливаем новые зависимости (добавлен whitenoise)
pip install -r requirements.txt
```

### Шаг 3: Сбор статики для админ панели

```bash
# Убедитесь, что вы в директории backend и виртуальное окружение активировано
cd ~/sofa-marketplace/backend
source venv/bin/activate

# Собираем статику (CSS, JS для админ панели)
python manage.py collectstatic --noinput
```

### Шаг 4: Проверка конфигурации Nginx для медиа файлов

Убедитесь, что в конфигурации Nginx для API (`/etc/nginx/sites-available/sofa-api`) есть блок для медиа файлов:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Замените на ваш домен

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статика для админ панели
    location /static/ {
        alias /home/deploy/sofa-marketplace/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Медиа файлы (изображения товаров)
    location /media/ {
        alias /home/deploy/sofa-marketplace/backend/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Важно:** Замените `api.yourdomain.com` на ваш реальный домен API (например, `api.vizhub.art`).

### Шаг 5: Проверка прав доступа

```bash
# Убедитесь, что у пользователя deploy есть права на директории
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/media
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles
sudo chmod -R 755 ~/sofa-marketplace/backend/media
```

### Шаг 6: Обновление переменных окружения Frontend

Убедитесь, что в файле `~/sofa-marketplace/frontend/.env.production` указан правильный домен API:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_NAME=Sofa Marketplace
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**Важно:** Замените `api.yourdomain.com` на ваш реальный домен API.

### Шаг 7: Пересборка Frontend

```bash
cd ~/sofa-marketplace/frontend

# Пересобираем проект с новыми настройками
npm run build
```

### Шаг 8: Перезапуск сервисов

```bash
# Перезапускаем Django backend
sudo systemctl restart sofa-backend

# Перезапускаем Next.js frontend
sudo systemctl restart sofa-frontend

# Перезагружаем Nginx
sudo systemctl reload nginx
```

### Шаг 9: Проверка работы

1. **Проверка админ панели:**

   - Откройте `https://api.yourdomain.com/admin/`
   - Стили должны загружаться правильно

2. **Проверка изображений:**

   - Откройте главную страницу сайта
   - Изображения товаров должны отображаться
   - Проверьте в консоли браузера (F12), нет ли ошибок 404 для изображений

3. **Проверка статики:**

   ```bash
   # Проверьте, что статика доступна
   curl -I https://api.yourdomain.com/static/admin/css/base.css

   # Проверьте, что медиа доступны
   curl -I https://api.yourdomain.com/media/products/какое-то-изображение.jpg
   ```

### Шаг 10: Проверка логов (если проблемы остались)

```bash
# Логи Django
tail -f ~/sofa-marketplace/backend/logs/error.log

# Логи Nginx
sudo tail -f /var/log/nginx/error.log

# Логи Next.js
sudo journalctl -u sofa-frontend -f
```

## Дополнительные проверки

### Проверка, что WhiteNoise работает

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py check
```

### Проверка структуры директорий

```bash
# Должна существовать директория staticfiles
ls -la ~/sofa-marketplace/backend/staticfiles/

# Должна существовать директория media
ls -la ~/sofa-marketplace/backend/media/
```

### Если изображения все еще не работают

1. Проверьте, что URL изображений в API содержат полный домен:

   ```bash
   curl https://api.yourdomain.com/api/products/ | grep image
   ```

   URL должны начинаться с `https://api.yourdomain.com/media/...`

2. Проверьте, что файлы действительно существуют:

   ```bash
   ls -la ~/sofa-marketplace/backend/media/products/
   ```

3. Проверьте конфигурацию Nginx - убедитесь, что блок `/media/` правильно настроен

## Быстрая команда для всего процесса

```bash
cd ~/sofa-marketplace/backend && \
source venv/bin/activate && \
pip install -r requirements.txt && \
python manage.py collectstatic --noinput && \
sudo systemctl restart sofa-backend && \
cd ../frontend && \
npm run build && \
sudo systemctl restart sofa-frontend && \
sudo systemctl reload nginx && \
echo "Готово! Проверьте сайт."
```

---

**Примечание:** После всех изменений убедитесь, что SSL сертификаты действительны и сайт доступен по HTTPS.
