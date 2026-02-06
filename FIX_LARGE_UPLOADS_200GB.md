# Исправление проблемы с загрузкой больших файлов (200GB)

## Проблема

Сайт падает при попытке загрузить большие файлы, даже после установки лимитов в 200GB в nginx и Django.

## Причина

Основная проблема была в настройке `FILE_UPLOAD_MAX_MEMORY_SIZE = 200GB` в Django. Это заставляло Django пытаться загрузить весь файл в память, что приводило к падению сервера из-за нехватки памяти.

**Важно:** `FILE_UPLOAD_MAX_MEMORY_SIZE` должен быть **небольшим** (например, 100MB), чтобы файлы сразу писались на диск, а не в память. `DATA_UPLOAD_MAX_MEMORY_SIZE` может быть большим (200GB) - это лимит размера всего запроса.

## Решение

### 1. Обновлены настройки Django (`backend/config/settings.py`)

```python
# Файлы больше 100MB будут автоматически писаться на диск (streaming)
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB

# Максимальный размер всего запроса (включая все поля формы)
DATA_UPLOAD_MAX_MEMORY_SIZE = 200 * 1024 * 1024 * 1024  # 200 GB
```

### 2. Настройка systemd лимитов

Выполните на сервере:

```bash
# Запустите скрипт настройки
bash deploy/fix-large-uploads.sh

# Или настройте вручную:

# Для nginx
sudo mkdir -p /etc/systemd/system/nginx.service.d
sudo tee /etc/systemd/system/nginx.service.d/override.conf > /dev/null <<EOF
[Service]
LimitNOFILE=65536
LimitNPROC=65536
EOF

# Для sofa-backend
sudo mkdir -p /etc/systemd/system/sofa-backend.service.d
sudo tee /etc/systemd/system/sofa-backend.service.d/override.conf > /dev/null <<EOF
[Service]
LimitNOFILE=65536
LimitNPROC=65536
EOF

# Применить изменения
sudo systemctl daemon-reload
sudo systemctl restart nginx
sudo systemctl restart sofa-backend
```

### 3. Проверка конфигурации

#### Nginx (`infra/nginx/nginx.conf`)

Убедитесь, что установлены:
- `client_max_body_size 200G;`
- `proxy_buffering off;` (важно для streaming)
- `proxy_request_buffering off;` (важно для streaming)
- Таймауты: `proxy_read_timeout 14400s;` (4 часа)

#### Gunicorn (`backend/gunicorn_config.py`)

Убедитесь, что установлены:
- `timeout = 14400` (4 часа)
- `graceful_timeout = 14400` (4 часа)

### 4. Перезапуск сервисов

```bash
# Проверка конфигурации nginx
sudo nginx -t

# Перезапуск сервисов
sudo systemctl restart nginx
sudo systemctl restart sofa-backend

# Проверка статуса
sudo systemctl status nginx
sudo systemctl status sofa-backend
```

## Как это работает

1. **Nginx** принимает файл и передает его в Gunicorn через proxy (streaming, без буферизации)
2. **Django** получает файл и, так как он больше 100MB, сразу пишет его на диск (не в память)
3. **S3 Storage** (если настроен) получает файл с диска и загружает в S3
4. Временный файл удаляется после загрузки в S3

## Проверка работы

### Мониторинг логов

```bash
# Логи nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Логи gunicorn
sudo journalctl -u sofa-backend -f

# Логи Django
tail -f backend/logs/error.log
```

### Проверка использования памяти

```bash
# Во время загрузки большого файла
watch -n 1 free -h
htop
```

Память не должна расти до 200GB - файл должен писаться на диск.

### Проверка использования диска

```bash
# Проверка свободного места
df -h

# Проверка временных файлов Django
du -sh /tmp/django_*
```

## Важные замечания

1. **Место на диске:** Убедитесь, что на сервере достаточно свободного места (минимум 200GB + запас)
2. **Время загрузки:** Загрузка 200GB файла может занять несколько часов даже при хорошем интернете
3. **Таймауты:** Убедитесь, что таймауты установлены на 4 часа (14400 секунд) во всех местах
4. **S3:** Если используется S3, файлы должны загружаться напрямую в S3, а не на локальный диск

## Устранение проблем

### Проблема: "413 Request Entity Too Large"

**Решение:** Проверьте, что `client_max_body_size 200G;` установлен в правильном блоке nginx (server или location /api/)

### Проблема: Таймауты при загрузке

**Решение:** 
- Проверьте таймауты в nginx: `proxy_read_timeout 14400s;`
- Проверьте таймауты в gunicorn: `timeout = 14400`
- Проверьте таймауты на уровне балансировщика (если используется)

### Проблема: Нехватка памяти

**Решение:**
- Убедитесь, что `FILE_UPLOAD_MAX_MEMORY_SIZE = 100MB` (не 200GB!)
- Убедитесь, что `proxy_buffering off;` установлен в nginx
- Проверьте, что файлы пишутся на диск, а не в память

### Проблема: Нехватка места на диске

**Решение:**
- Освободите место на диске
- Настройте автоматическую очистку временных файлов
- Используйте S3 для хранения файлов

## Дополнительные рекомендации

Для файлов такого размера рекомендуется:

1. **Использовать chunked upload** (загрузка по частям) на фронтенде
2. **Прямая загрузка в S3** через presigned URLs (обход Django)
3. **Resumable uploads** (возможность возобновления прерванной загрузки)
4. **Асинхронная обработка** больших файлов (Celery, RQ)
