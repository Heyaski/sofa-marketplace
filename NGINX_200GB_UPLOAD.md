# Настройка Nginx для загрузки файлов до 200GB

## Обзор

Для поддержки загрузки файлов размером до 200GB необходимо настроить несколько компонентов:
1. Nginx (прокси-сервер)
2. Django/Gunicorn (бэкенд)
3. Системные лимиты (если необходимо)

## 1. Настройка Nginx

### 1.1 Обновление конфигурации

Обновлены следующие параметры в конфигурации Nginx:

```nginx
# Лимит размера загружаемых файлов
client_max_body_size 200G;

# Таймауты для загрузки больших файлов (4 часа)
proxy_connect_timeout 14400s;  # 4 часа
proxy_send_timeout 14400s;     # 4 часа
proxy_read_timeout 14400s;    # 4 часа
send_timeout 14400s;          # 4 часа

# Буферы для больших файлов
client_body_buffer_size 128k;
proxy_buffering off;  # Отключаем буферизацию для streaming
proxy_request_buffering off;  # Отключаем буферизацию запросов
```

### 1.2 Применение изменений

Если вы используете конфигурацию из `infra/nginx/nginx.conf`:

```bash
# Скопируйте конфигурацию в нужное место
sudo cp infra/nginx/nginx.conf /etc/nginx/sites-available/sofa-api

# Или если используете основной конфиг
sudo nano /etc/nginx/nginx.conf
# Добавьте настройки в http блок или server блок
```

### 1.3 Проверка и перезагрузка

```bash
# Проверка конфигурации
sudo nginx -t

# Если проверка успешна, перезагрузите nginx
sudo systemctl reload nginx
# или
sudo systemctl restart nginx
```

## 2. Настройка Django/Gunicorn

### 2.1 Настройки Django

В `backend/config/settings.py` или вашем файле настроек:

```python
# Максимальный размер загружаемого файла (в байтах)
# 200GB = 200 * 1024 * 1024 * 1024 = 214748364800 байт
DATA_UPLOAD_MAX_MEMORY_SIZE = 214748364800  # 200GB
FILE_UPLOAD_MAX_MEMORY_SIZE = 214748364800  # 200GB

# Таймауты для больших загрузок
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000
```

### 2.2 Настройки Gunicorn

В `backend/gunicorn_config.py`:

```python
# Увеличиваем таймауты для больших загрузок
timeout = 14400  # 4 часа (в секундах)
graceful_timeout = 14400  # 4 часа

# Увеличиваем количество воркеров для обработки больших запросов
workers = 4
worker_class = 'sync'  # sync лучше для больших файлов, чем async

# Увеличиваем лимиты памяти
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
```

### 2.3 Перезапуск Gunicorn

```bash
# Если используете systemd
sudo systemctl restart sofa-backend

# Или если запускаете вручную
pkill -f gunicorn
# Затем запустите снова с обновленной конфигурацией
```

## 3. Системные лимиты

### 3.1 Проверка текущих лимитов

```bash
# Проверка лимитов для текущего пользователя
ulimit -a

# Проверка лимитов для процесса nginx
cat /proc/$(pgrep nginx | head -1)/limits
```

### 3.2 Увеличение лимитов (если необходимо)

#### Для systemd сервисов (nginx, gunicorn):

Создайте файл `/etc/systemd/system/nginx.service.d/override.conf`:

```ini
[Service]
LimitNOFILE=65536
LimitNPROC=65536
```

Создайте файл `/etc/systemd/system/sofa-backend.service.d/override.conf`:

```ini
[Service]
LimitNOFILE=65536
LimitNPROC=65536
```

Примените изменения:

```bash
sudo systemctl daemon-reload
sudo systemctl restart nginx
sudo systemctl restart sofa-backend
```

#### Для системных лимитов:

Отредактируйте `/etc/security/limits.conf`:

```
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
```

После этого перелогиньтесь или перезагрузите систему.

## 4. Дополнительные рекомендации

### 4.1 Мониторинг загрузок

Для больших файлов рекомендуется:

1. **Использовать прогресс-бар** на фронтенде для отслеживания загрузки
2. **Логировать** процесс загрузки в Django
3. **Мониторить** использование диска и памяти

### 4.2 Оптимизация для больших файлов

1. **Используйте chunked upload** (загрузка по частям) вместо загрузки всего файла сразу
2. **Настройте S3** или другой объектный storage для хранения больших файлов
3. **Используйте CDN** для раздачи больших файлов

### 4.3 Безопасность

При загрузке файлов такого размера:

1. **Ограничьте доступ** - только авторизованные пользователи
2. **Валидируйте типы файлов** - проверяйте расширения и MIME-типы
3. **Сканируйте на вирусы** - для больших файлов используйте асинхронное сканирование
4. **Ограничьте частоту загрузок** - используйте rate limiting

### 4.4 Пример настройки rate limiting в Nginx

```nginx
# В http блоке
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=1r/m;

# В server блоке
location /api/upload/ {
    limit_req zone=upload_limit burst=2;
    # ... остальные настройки
}
```

## 5. Проверка работы

### 5.1 Тестовая загрузка

```bash
# Создайте тестовый файл (например, 1GB)
dd if=/dev/zero of=test_1gb.bin bs=1M count=1024

# Попробуйте загрузить через curl
curl -X POST \
  -F "file=@test_1gb.bin" \
  http://your-domain.com/api/upload/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.2 Мониторинг логов

```bash
# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Логи Gunicorn/Django
sudo journalctl -u sofa-backend -f
```

## 6. Устранение проблем

### Проблема: "413 Request Entity Too Large"

**Решение:** Убедитесь, что `client_max_body_size 200G;` установлен в правильном блоке (server или location).

### Проблема: Таймауты при загрузке

**Решение:** 
- Увеличьте таймауты в Nginx
- Увеличьте таймауты в Gunicorn
- Проверьте таймауты на уровне балансировщика (если используется)

### Проблема: Нехватка памяти

**Решение:**
- Убедитесь, что `proxy_buffering off;` установлен
- Используйте streaming upload в Django
- Увеличьте swap на сервере (если необходимо)

### Проблема: Медленная загрузка

**Решение:**
- Проверьте пропускную способность сети
- Используйте chunked upload
- Рассмотрите использование прямого upload в S3 (presigned URLs)

## 7. Важные замечания

⚠️ **Внимание:**
- Загрузка файлов размером 200GB может занять **несколько часов** даже при хорошем интернет-соединении
- Убедитесь, что на сервере достаточно **свободного места на диске**
- Мониторьте использование **памяти** и **CPU** во время загрузки
- Рекомендуется использовать **асинхронную обработку** больших файлов (Celery, RQ и т.д.)

## 8. Альтернативные решения

Для файлов такого размера рекомендуется рассмотреть:

1. **Прямая загрузка в S3** через presigned URLs
2. **FTP/SFTP сервер** для больших файлов
3. **Resumable uploads** (возможность возобновления прерванной загрузки)
4. **P2P загрузка** для очень больших файлов
