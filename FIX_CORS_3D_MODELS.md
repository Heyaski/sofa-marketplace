# 🔧 Исправление CORS ошибки для 3D моделей

## Проблема

При попытке загрузить 3D модель появляется ошибка:
```
Access to fetch at 'https://api.vizhub.art/media/assets/IMR-515606GRY.glb' 
from origin 'https://vizhub.art' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Причина

Nginx не настроен для отправки CORS заголовков при раздаче медиа файлов. Django CORS настройки работают только для API запросов, но не для статических/медиа файлов, которые отдаются напрямую через nginx.

## Решение: Настройка CORS в Nginx

### Шаг 1: Найдите конфигурацию nginx для API

Обычно это файл: `/etc/nginx/sites-available/sofa-api` или `/etc/nginx/sites-available/api.vizhub.art`

### Шаг 2: Обновите конфигурацию nginx

Добавьте CORS заголовки в секцию `location /media/`:

```nginx
server {
    listen 80;
    server_name api.vizhub.art;

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
        
        # CORS заголовки для статики
        add_header 'Access-Control-Allow-Origin' 'https://vizhub.art' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    }

    location /media/ {
        alias /home/deploy/sofa-marketplace/backend/media/;
        
        # CORS заголовки для медиа файлов (включая 3D модели)
        add_header 'Access-Control-Allow-Origin' 'https://vizhub.art' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        
        # Для больших файлов (3D модели могут быть большими)
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
    }
}
```

### Шаг 3: Если используете HTTPS

Если у вас настроен HTTPS, обновите конфигурацию для порта 443:

```nginx
server {
    listen 443 ssl http2;
    server_name api.vizhub.art;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /home/deploy/sofa-marketplace/backend/media/;
        
        # CORS заголовки для медиа файлов
        add_header 'Access-Control-Allow-Origin' 'https://vizhub.art' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    }
}
```

### Шаг 4: Обработка OPTIONS запросов (если нужно)

Если браузер отправляет предварительные OPTIONS запросы, добавьте обработку:

```nginx
location /media/ {
    alias /home/deploy/sofa-marketplace/backend/media/;
    
    # Обработка OPTIONS запросов
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://vizhub.art' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
    
    # CORS заголовки для GET запросов
    add_header 'Access-Control-Allow-Origin' 'https://vizhub.art' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
}
```

### Шаг 5: Проверьте конфигурацию и перезагрузите nginx

```bash
# Проверьте синтаксис конфигурации
sudo nginx -t

# Если все ОК, перезагрузите nginx
sudo systemctl reload nginx
# или
sudo service nginx reload
```

### Шаг 6: Проверьте результат

1. Откройте страницу товара
2. Откройте консоль браузера (F12)
3. Нажмите "Открыть 3D Viewer"
4. Проверьте, что CORS ошибка исчезла
5. 3D модель должна загрузиться

## Альтернативное решение: Разрешить все домены (только для разработки)

Если нужно разрешить доступ с любого домена (не рекомендуется для продакшена):

```nginx
location /media/ {
    alias /home/deploy/sofa-marketplace/backend/media/;
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
}
```

## Для нескольких доменов

Если фронтенд может быть на разных доменах:

```nginx
location /media/ {
    alias /home/deploy/sofa-marketplace/backend/media/;
    
    # Проверяем origin и устанавливаем соответствующий заголовок
    set $cors_origin "";
    if ($http_origin ~* "^https://(vizhub\.art|www\.vizhub\.art)$") {
        set $cors_origin $http_origin;
    }
    
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
}
```

## Проверка CORS заголовков

После настройки проверьте заголовки:

```bash
curl -I -H "Origin: https://vizhub.art" https://api.vizhub.art/media/assets/IMR-515606GRY.glb
```

Должны быть заголовки:
```
Access-Control-Allow-Origin: https://vizhub.art
Access-Control-Allow-Methods: GET, OPTIONS
```

---

**После применения изменений:**
1. Перезагрузите nginx
2. Очистите кеш браузера (Ctrl+Shift+Delete)
3. Обновите страницу товара
4. Попробуйте открыть 3D Viewer снова

