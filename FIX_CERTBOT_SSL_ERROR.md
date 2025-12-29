# 🔒 Исправление ошибки Certbot: несуществующий SSL сертификат

## Проблема

При попытке получить SSL сертификат для `vizhub.pro` возникает ошибка:
```
cannot load certificate "/etc/letsencrypt/live/api.vizhub.pro/fullchain.pem": 
BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory)
```

Это происходит потому, что в конфигурации Nginx уже есть ссылка на SSL сертификат для `api.vizhub.pro`, но этот сертификат еще не создан.

## Решение

Нужно сначала получить сертификаты для основного домена, а затем для API поддомена.

### Шаг 1: Найдите и временно отключите SSL для API

Найдите конфигурацию Nginx для API:

```bash
# Проверьте, какие конфигурации активны
sudo ls -la /etc/nginx/sites-enabled/

# Обычно это один из файлов:
# - /etc/nginx/sites-available/sofa-api
# - /etc/nginx/sites-available/api.vizhub.pro
# - /etc/nginx/conf.d/api.conf
```

Откройте файл конфигурации API:

```bash
sudo nano /etc/nginx/sites-available/sofa-api
# или
sudo nano /etc/nginx/sites-available/api.vizhub.pro
```

### Шаг 2: Временно закомментируйте SSL блоки

Если в файле есть блок с SSL для `api.vizhub.pro`, закомментируйте его:

**Было:**
```nginx
server {
    listen 443 ssl http2;
    server_name api.vizhub.pro;
    
    ssl_certificate /etc/letsencrypt/live/api.vizhub.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vizhub.pro/privkey.pem;
    
    # ... остальные настройки ...
}
```

**Стало (закомментировано):**
```nginx
# Временно закомментировано - сертификат будет получен позже
# server {
#     listen 443 ssl http2;
#     server_name api.vizhub.pro;
#     
#     ssl_certificate /etc/letsencrypt/live/api.vizhub.pro/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/api.vizhub.pro/privkey.pem;
#     
#     # ... остальные настройки ...
# }
```

**Оставьте только HTTP блок (порт 80):**
```nginx
server {
    listen 80;
    server_name api.vizhub.pro;

    client_max_body_size 5G;

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

### Шаг 3: Проверьте конфигурацию Nginx

```bash
sudo nginx -t
```

Если есть ошибки, исправьте их. Должно быть сообщение:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Шаг 4: Перезагрузите Nginx

```bash
sudo systemctl reload nginx
```

### Шаг 5: Получите SSL сертификат для основного домена

Теперь получите сертификат для основного домена:

```bash
sudo certbot --nginx -d vizhub.pro -d www.vizhub.pro
```

Certbot автоматически:
- Получит сертификат
- Обновит конфигурацию Nginx для фронтенда
- Настроит редирект с HTTP на HTTPS

### Шаг 6: Получите SSL сертификат для API поддомена

После успешного получения сертификата для основного домена, получите сертификат для API:

```bash
sudo certbot --nginx -d api.vizhub.pro
```

Certbot автоматически:
- Получит сертификат для `api.vizhub.pro`
- Добавит SSL блок в конфигурацию Nginx
- Настроит редирект с HTTP на HTTPS

### Шаг 7: Проверьте работу

```bash
# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx

# Проверьте статус сертификатов
sudo certbot certificates
```

### Шаг 8: Проверьте доступность сайтов

Откройте в браузере:
- `https://vizhub.pro` - должен открываться с HTTPS
- `https://www.vizhub.pro` - должен открываться с HTTPS
- `https://api.vizhub.pro` - должен открываться с HTTPS

---

## Альтернативный способ: Получение сертификатов без Nginx плагина

Если проблема сохраняется, можно получить сертификаты вручную:

### Вариант 1: Standalone режим (остановите Nginx временно)

```bash
# Остановите Nginx
sudo systemctl stop nginx

# Получите сертификат для основного домена
sudo certbot certonly --standalone -d vizhub.pro -d www.vizhub.pro

# Получите сертификат для API
sudo certbot certonly --standalone -d api.vizhub.pro

# Запустите Nginx
sudo systemctl start nginx
```

### Вариант 2: Webroot режим (если есть доступ к файлам)

```bash
# Создайте директорию для верификации
sudo mkdir -p /var/www/html/.well-known/acme-challenge

# Получите сертификат
sudo certbot certonly --webroot -w /var/www/html -d vizhub.pro -d www.vizhub.pro
sudo certbot certonly --webroot -w /var/www/html -d api.vizhub.pro
```

После получения сертификатов вручную, нужно будет вручную добавить SSL блоки в конфигурацию Nginx.

---

## Проверка конфигурации после исправления

После получения всех сертификатов, проверьте конфигурацию:

```bash
# Проверьте синтаксис
sudo nginx -t

# Проверьте статус сертификатов
sudo certbot certificates

# Проверьте автоматическое обновление
sudo certbot renew --dry-run
```

---

## Автоматическое обновление сертификатов

Certbot автоматически создает задачу для обновления сертификатов. Проверьте:

```bash
# Проверка cron задачи
sudo crontab -l | grep certbot

# Или проверьте systemd таймер
systemctl list-timers | grep certbot
```

---

## Если проблема сохраняется

1. **Проверьте, что домены указывают на ваш сервер:**
   ```bash
   dig vizhub.pro
   dig www.vizhub.pro
   dig api.vizhub.pro
   ```

2. **Проверьте, что порты 80 и 443 открыты:**
   ```bash
   sudo ufw status
   # или
   sudo iptables -L -n
   ```

3. **Проверьте логи:**
   ```bash
   sudo tail -f /var/log/letsencrypt/letsencrypt.log
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Удалите старые конфигурации Certbot (если нужно):**
   ```bash
   sudo certbot delete --cert-name api.vizhub.pro
   ```

---

## Пример правильной конфигурации после получения сертификатов

После успешного получения сертификатов, конфигурация должна выглядеть так:

**Файл: `/etc/nginx/sites-available/sofa-frontend`**
```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name vizhub.pro www.vizhub.pro;
    return 301 https://$server_name$request_uri;
}

# HTTPS блок
server {
    listen 443 ssl http2;
    server_name vizhub.pro www.vizhub.pro;

    ssl_certificate /etc/letsencrypt/live/vizhub.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vizhub.pro/privkey.pem;

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

**Файл: `/etc/nginx/sites-available/sofa-api`**
```nginx
# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name api.vizhub.pro;
    return 301 https://$server_name$request_uri;
}

# HTTPS блок
server {
    listen 443 ssl http2;
    server_name api.vizhub.pro;

    ssl_certificate /etc/letsencrypt/live/api.vizhub.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vizhub.pro/privkey.pem;

    client_max_body_size 5G;

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

---

**Готово!** После выполнения этих шагов все домены должны работать с HTTPS.

