# Исправление ошибки 413 Request Entity Too Large для больших ZIP архивов

## Проблема

При загрузке больших ZIP архивов (3GB+) возникает ошибка:
```
413 Request Entity Too Large
nginx/1.24.0 (Ubuntu)
```

## Решение

### 1. Обновите конфигурацию Nginx на сервере

**Найдите конфигурационный файл:**
```bash
# Обычно это один из этих файлов:
sudo nano /etc/nginx/sites-available/sofa-api
# или
sudo nano /etc/nginx/sites-available/default
# или
sudo nano /etc/nginx/nginx.conf
```

**Добавьте или измените эти строки в блоке `server {`:**

```nginx
server {
    listen 80;
    server_name api.vizhub.art;  # ваш домен
    
    # Увеличиваем лимит размера загружаемых файлов до 5GB
    client_max_body_size 5G;
    
    # Увеличиваем таймауты для загрузки больших файлов (30 минут)
    proxy_connect_timeout 1800s;
    proxy_send_timeout 1800s;
    proxy_read_timeout 1800s;
    send_timeout 1800s;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для больших файлов
        proxy_connect_timeout 1800s;
        proxy_send_timeout 1800s;
        proxy_read_timeout 1800s;
    }
}
```

### 2. Проверьте и примените изменения

```bash
# Проверьте синтаксис конфигурации
sudo nginx -t

# Если проверка прошла успешно, перезагрузите Nginx
sudo systemctl reload nginx

# Или перезапустите полностью
sudo systemctl restart nginx
```

### 3. Проверьте статус

```bash
# Проверьте, что Nginx работает
sudo systemctl status nginx

# Посмотрите логи, если есть ошибки
sudo tail -f /var/log/nginx/error.log
```

## Дополнительные настройки Django

Убедитесь, что в `backend/config/settings.py` установлены правильные лимиты:

```python
# Максимальный размер файла в памяти
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024 * 1024  # 1 GB

# Максимальный размер данных запроса
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024 * 1024  # 1 GB

# Максимальное количество файлов
DATA_UPLOAD_MAX_NUMBER_FILES = 10000
```

После изменения Django settings перезапустите Django сервер:
```bash
sudo systemctl restart ваш-backend-service
```

## Важные замечания

1. **Размер лимита:** `client_max_body_size 5G` позволяет загружать файлы до 5GB. Если нужны большие файлы, увеличьте до 10G или больше.

2. **Таймауты:** Для загрузки 3-5GB файлов при медленном интернете может потребоваться 30+ минут. Убедитесь, что таймауты достаточны.

3. **Память сервера:** Убедитесь, что на сервере достаточно места на диске для временного хранения файлов во время загрузки.

4. **S3 хранилище:** Если используется S3, файлы должны загружаться напрямую в S3, а не на локальный диск сервера.

## Проверка работы

После применения изменений попробуйте загрузить архив снова. Если ошибка 413 все еще возникает:

1. Проверьте, что изменения действительно применены:
   ```bash
   sudo grep -r "client_max_body_size" /etc/nginx/
   ```

2. Убедитесь, что перезагрузили Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

3. Проверьте логи Nginx на наличие других ошибок:
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

## Альтернативное решение

Если проблема сохраняется, можно также добавить `client_max_body_size` в основной конфигурационный файл `/etc/nginx/nginx.conf` в блоке `http {`:

```nginx
http {
    # Глобальный лимит для всех серверов
    client_max_body_size 5G;
    
    # ... остальные настройки
}
```
