# Исправление ошибки подключения к API (Failed to connect)

## Проблема

```
curl: (7) Failed to connect to api.vizhub.pro port 443 after 1 ms: Couldn't connect to server
```

Это означает, что сервер не отвечает на порту 443 (HTTPS).

## Диагностика

### Шаг 1: Проверьте статус Nginx

```bash
sudo systemctl status nginx
```

Если Nginx не запущен:
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Шаг 2: Проверьте статус Backend сервиса

```bash
sudo systemctl status sofa-backend.service
```

Если сервис не запущен:
```bash
sudo systemctl start sofa-backend.service
sudo systemctl enable sofa-backend.service
```

### Шаг 3: Проверьте, что Backend слушает на порту 8000

```bash
# Проверьте, что gunicorn запущен
ps aux | grep gunicorn

# Проверьте, что порт 8000 слушается
sudo netstat -tlnp | grep 8000
# или
sudo ss -tlnp | grep 8000
```

Если порт не слушается, проверьте логи:
```bash
sudo journalctl -u sofa-backend.service -n 50 --no-pager
```

### Шаг 4: Проверьте конфигурацию Nginx

```bash
# Проверьте, что конфигурация существует
sudo ls -la /etc/nginx/sites-available/sofa-api
sudo ls -la /etc/nginx/sites-enabled/sofa-api

# Проверьте синтаксис конфигурации
sudo nginx -t
```

### Шаг 5: Проверьте, что SSL сертификат настроен

```bash
# Проверьте, что есть конфигурация для HTTPS
sudo cat /etc/nginx/sites-available/sofa-api | grep -A 5 "listen 443"

# Проверьте наличие сертификатов
sudo ls -la /etc/letsencrypt/live/api.vizhub.pro/
```

Если SSL не настроен, нужно настроить его через Certbot.

### Шаг 6: Проверьте Firewall

```bash
# Проверьте статус firewall
sudo ufw status

# Убедитесь, что порты 80 и 443 открыты
sudo ufw allow 'Nginx Full'
sudo ufw reload
```

### Шаг 7: Проверьте DNS

```bash
# Проверьте, что домен указывает на правильный IP
nslookup api.vizhub.pro
dig api.vizhub.pro

# Проверьте с сервера
curl -I http://localhost
curl -I http://127.0.0.1:8000
```

## Решение

### Вариант 1: Если SSL не настроен

1. Убедитесь, что Nginx конфигурация для HTTP (порт 80) работает:
```bash
curl http://api.vizhub.pro
```

2. Настройте SSL через Certbot:
```bash
sudo certbot --nginx -d api.vizhub.pro
```

3. Проверьте, что конфигурация обновилась:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Вариант 2: Если Nginx не запущен

```bash
# Запустите Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверьте логи, если не запускается
sudo journalctl -u nginx -n 50 --no-pager
```

### Вариант 3: Если Backend не запущен

Следуйте инструкциям из `FIX_SYSTEMD_SERVICE_203_ERROR.md` для исправления systemd сервиса.

### Вариант 4: Если конфигурация Nginx неправильная

Убедитесь, что файл `/etc/nginx/sites-available/sofa-api` содержит:

```nginx
server {
    listen 80;
    server_name api.vizhub.pro;

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

Для HTTPS (после настройки SSL):

```nginx
server {
    listen 443 ssl http2;
    server_name api.vizhub.pro;

    ssl_certificate /etc/letsencrypt/live/api.vizhub.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vizhub.pro/privkey.pem;

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

server {
    listen 80;
    server_name api.vizhub.pro;
    return 301 https://$server_name$request_uri;
}
```

После изменений:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Быстрая проверка всех компонентов

Выполните эту команду для проверки всех компонентов:

```bash
echo "=== Проверка статуса сервисов ==="
sudo systemctl status nginx --no-pager | head -5
sudo systemctl status sofa-backend.service --no-pager | head -5

echo ""
echo "=== Проверка портов ==="
sudo ss -tlnp | grep -E ":(80|443|8000)"

echo ""
echo "=== Проверка локального подключения ==="
curl -I http://127.0.0.1:8000 2>&1 | head -3

echo ""
echo "=== Проверка Nginx конфигурации ==="
sudo nginx -t
```

## Частые проблемы

1. **Nginx не запущен** - запустите: `sudo systemctl start nginx`
2. **Backend не запущен** - проверьте логи: `sudo journalctl -u sofa-backend.service`
3. **SSL не настроен** - настройте через Certbot: `sudo certbot --nginx -d api.vizhub.pro`
4. **Firewall блокирует** - откройте порты: `sudo ufw allow 'Nginx Full'`
5. **Неправильный server_name** - убедитесь, что в конфигурации указан правильный домен
