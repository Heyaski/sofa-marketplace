# Диагностика и исправление systemd сервиса

## Проверка логов

```bash
# Последние 30 строк логов
sudo journalctl -u sofa-backend.service -n 30 --no-pager

# Или в реальном времени
sudo journalctl -u sofa-backend.service -f
```

## Типичные проблемы

### Проблема 1: Type=notify не работает

Если в логах видите ошибки связанные с `Type=notify`, измените на `Type=simple`:

```bash
sudo nano /etc/systemd/system/sofa-backend.service
```

Измените:

```ini
Type=notify
```

На:

```ini
Type=simple
```

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl restart sofa-backend
```

### Проблема 2: Проблемы с правами доступа

```bash
# Убедитесь, что пользователь deploy владеет файлами
sudo chown -R deploy:deploy /home/deploy/sofa-marketplace

# Убедитесь, что директория для логов существует и доступна
mkdir -p /home/deploy/sofa-marketplace/backend/logs
sudo chown -R deploy:deploy /home/deploy/sofa-marketplace/backend/logs
```

### Проблема 3: Gunicorn не может создать PID файл

В `gunicorn_config.py` убедитесь, что путь к PID файлу правильный и директория доступна:

```bash
# Проверьте, что директория существует
ls -la /home/deploy/sofa-marketplace/backend/

# Если нужно, создайте директорию для PID файла
touch /home/deploy/sofa-marketplace/backend/gunicorn.pid
sudo chown deploy:deploy /home/deploy/sofa-marketplace/backend/gunicorn.pid
```

### Проблема 4: Проблемы с виртуальным окружением

Проверьте, что виртуальное окружение активировано правильно и gunicorn установлен:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
which gunicorn
gunicorn --version

# Если gunicorn не найден, установите его
pip install gunicorn
```

### Проблема 5: Проблемы с Django конфигурацией

Проверьте, что Django может запуститься:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
python manage.py check
python manage.py check --deploy
```

## Правильная конфигурация systemd сервиса

Убедитесь, что файл `/etc/systemd/system/sofa-backend.service` выглядит так:

```ini
[Unit]
Description=Sofa Marketplace Django Backend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/sofa-marketplace/backend
Environment="PATH=/home/deploy/sofa-marketplace/backend/venv/bin"
ExecStart=/home/deploy/sofa-marketplace/backend/venv/bin/gunicorn \
    --config gunicorn_config.py \
    config.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Важно:** Если `Type=notify` не работает, используйте `Type=simple`.

## После изменений

```bash
# Перезагрузите конфигурацию systemd
sudo systemctl daemon-reload

# Перезапустите сервис
sudo systemctl restart sofa-backend

# Проверьте статус
sudo systemctl status sofa-backend
```

## Ручной запуск для тестирования

Если сервис не запускается, попробуйте запустить gunicorn вручную:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
gunicorn --config gunicorn_config.py config.wsgi:application
```

Это покажет реальную ошибку, которая мешает запуску.
