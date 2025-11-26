# Исправление проблемы: админ панель без стилей

## Проблема

Админ панель отображается без CSS стилей - все элементы с дефолтным оформлением браузера.

## Причины

1. Статические файлы не собраны (`collectstatic` не выполнен)
2. Nginx не правильно настроен для обслуживания `/static/`
3. WhiteNoise не работает или конфликтует с Nginx
4. Неправильные права доступа к файлам

## Решение

### Шаг 1: Проверка и сбор статики

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate

# Проверьте, что директория staticfiles существует
ls -la staticfiles/

# Пересоберите статику
python manage.py collectstatic --noinput --clear
```

Должно быть сообщение типа:

```
218 static files copied to '/home/deploy/sofa-marketplace/backend/staticfiles'
```

### Шаг 2: Проверка конфигурации Nginx

```bash
sudo nano /etc/nginx/sites-available/sofa-api
```

Убедитесь, что конфигурация содержит:

```nginx
server {
    listen 80;
    server_name api.vizhub.art;  # Ваш домен

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статика для админ панели - ВАЖНО!
    location /static/ {
        alias /home/deploy/sofa-marketplace/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Медиа файлы
    location /media/ {
        alias /home/deploy/sofa-marketplace/backend/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Важно:** Блок `/static/` должен быть **ПЕРЕД** блоком `/`, иначе все запросы будут проксироваться в Django.

### Шаг 3: Проверка прав доступа

```bash
# Убедитесь, что пользователь deploy владеет файлами
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles

# Проверьте, что Nginx может читать файлы
sudo chmod -R o+r ~/sofa-marketplace/backend/staticfiles
```

### Шаг 4: Перезагрузка Nginx

```bash
# Проверьте конфигурацию
sudo nginx -t

# Если OK, перезагрузите
sudo systemctl reload nginx
```

### Шаг 5: Проверка доступности статики

Откройте в браузере:

```
https://api.vizhub.art/static/admin/css/base.css
```

Если файл открывается и показывает CSS код - значит статика работает.

Если получаете 404, проверьте:

```bash
# Логи Nginx
sudo tail -f /var/log/nginx/error.log

# Проверьте, что файл существует
ls -la ~/sofa-marketplace/backend/staticfiles/admin/css/base.css
```

### Шаг 6: Если используете WhiteNoise

Если WhiteNoise включен, он может обслуживать статику вместо Nginx. В этом случае:

**Вариант А: Использовать только Nginx (рекомендуется)**

Закомментируйте WhiteNoise в `settings.py`:

```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # "whitenoise.middleware.WhiteNoiseMiddleware",  # Закомментировано
    # ... остальные
]
```

И закомментируйте:

```python
# STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
```

Затем перезапустите Django:

```bash
sudo systemctl restart sofa-backend
```

**Вариант Б: Использовать только WhiteNoise**

Уберите блок `/static/` из конфигурации Nginx, оставьте только проксирование в Django. WhiteNoise будет обслуживать статику.

### Шаг 7: Очистка кэша браузера

После исправления очистите кэш браузера (Ctrl+Shift+Delete) или откройте в режиме инкогнито.

## Быстрая проверка всех шагов

```bash
cd ~/sofa-marketplace/backend && \
source venv/bin/activate && \
python manage.py collectstatic --noinput --clear && \
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles && \
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles && \
sudo nginx -t && \
sudo systemctl reload nginx && \
echo "Готово! Проверьте https://api.vizhub.art/static/admin/css/base.css"
```

## Диагностика

Если проблема не решена:

1. **Проверьте логи Nginx:**

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Проверьте, что Django запущен:**

   ```bash
   sudo systemctl status sofa-backend
   ```

3. **Проверьте структуру статики:**

   ```bash
   ls -la ~/sofa-marketplace/backend/staticfiles/admin/
   ```

4. **Проверьте в браузере (F12 -> Network):**
   - Откройте админ панель
   - Посмотрите, какие запросы к `/static/` возвращают 404
   - Проверьте URL этих запросов

