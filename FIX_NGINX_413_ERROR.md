# 🔧 Исправление ошибки 413 Request Entity Too Large

## Проблема

При загрузке больших 3D файлов возникает ошибка:
```
413 Request Entity Too Large
nginx/1.24.0 (Ubuntu)
```

## Решение

### 1. Обновите конфигурацию Nginx

Найдите файл конфигурации nginx (обычно `/etc/nginx/sites-available/your-site` или `/etc/nginx/nginx.conf`).

Добавьте или обновите следующие настройки:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Увеличиваем лимит размера загружаемых файлов (для больших 3D моделей)
    client_max_body_size 500M;

    # Увеличиваем таймауты для загрузки больших файлов
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для больших файлов
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /static/ {
        alias /path/to/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /path/to/backend/media/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

### 2. Проверьте конфигурацию и перезапустите Nginx

```bash
# Проверить конфигурацию на ошибки
sudo nginx -t

# Перезапустить nginx
sudo systemctl restart nginx

# Или если используется другой способ управления
sudo service nginx restart
```

### 3. Если используете Beget панель

В панели Beget → Сайты → Настройки → Nginx, добавьте:

```nginx
client_max_body_size 500M;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
send_timeout 300s;
```

### 4. Дополнительные настройки Django (уже сделано)

В `backend/config/settings.py` уже настроено:
- `FILE_UPLOAD_MAX_MEMORY_SIZE = 100 MB`
- `DATA_UPLOAD_MAX_MEMORY_SIZE = 100 MB`
- `DATA_UPLOAD_MAX_NUMBER_FILES = 1000`

### 5. Настройки Gunicorn (если используется)

В `gunicorn_config.py` добавьте:

```python
timeout = 300  # 5 минут
keepalive = 5
```

## Проверка

После применения изменений:

1. Перезапустите nginx
2. Попробуйте загрузить большой ZIP архив с 3D файлами
3. Проверьте логи nginx: `sudo tail -f /var/log/nginx/error.log`
4. Проверьте логи Django/Gunicorn

## Размеры файлов

- **500M** - максимальный размер одного запроса (можно увеличить до 1G или больше)
- **300s** - таймаут для загрузки (5 минут, можно увеличить)

## Альтернативное решение

Если файлы очень большие (>500MB), рассмотрите:
1. Разбить ZIP архив на несколько частей
2. Использовать прямую загрузку через FTP/SFTP
3. Использовать асинхронную загрузку с прогресс-баром

