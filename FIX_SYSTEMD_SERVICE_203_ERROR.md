# Исправление ошибки 203/EXEC в systemd сервисе

## Проблема

Ошибка `status=203/EXEC` означает, что systemd не может выполнить команду из `ExecStart`. Это обычно происходит из-за:

1. Неправильного пути к исполняемому файлу
2. Отсутствия прав на выполнение
3. Неправильного PATH
4. Проблем с Type=notify

## Решение

### Шаг 1: Проверьте путь к gunicorn

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
which gunicorn
```

Должен показать путь, например: `/home/deploy/sofa-marketplace/backend/venv/bin/gunicorn`

### Шаг 2: Проверьте, что gunicorn установлен

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
gunicorn --version
```

Если gunicorn не найден:
```bash
pip install gunicorn
```

### Шаг 3: Исправьте конфигурацию systemd

Отредактируйте файл сервиса:

```bash
sudo nano /etc/systemd/system/sofa-backend.service
```

Используйте следующую конфигурацию:

```ini
[Unit]
Description=Sofa Marketplace Django Backend
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/sofa-marketplace/backend
Environment="PATH=/home/deploy/sofa-marketplace/backend/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/deploy/sofa-marketplace/backend/venv/bin/gunicorn \
    --config gunicorn_config.py \
    config.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Важные изменения:**
- `Type=simple` вместо `Type=notify` (notify требует специальной поддержки от gunicorn)
- Добавлен полный PATH в Environment
- Убрана зависимость от postgresql.service (если используется SQLite)

### Шаг 4: Проверьте права доступа

```bash
# Убедитесь, что пользователь deploy владеет файлами
sudo chown -R deploy:deploy /home/deploy/sofa-marketplace

# Убедитесь, что gunicorn исполняемый
chmod +x /home/deploy/sofa-marketplace/backend/venv/bin/gunicorn
```

### Шаг 5: Перезагрузите systemd и запустите сервис

```bash
sudo systemctl daemon-reload
sudo systemctl start sofa-backend.service
sudo systemctl status sofa-backend.service
```

### Шаг 6: Проверьте логи

Если сервис все еще не запускается:

```bash
sudo journalctl -u sofa-backend.service -n 50 --no-pager
```

## Альтернативное решение: Использование bash для запуска

Если проблема сохраняется, можно использовать bash для запуска:

```ini
[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/sofa-marketplace/backend
Environment="PATH=/home/deploy/sofa-marketplace/backend/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/bin/bash -c 'cd /home/deploy/sofa-marketplace/backend && source venv/bin/activate && gunicorn --config gunicorn_config.py config.wsgi:application'
Restart=always
RestartSec=10
```

## Ручной запуск для диагностики

Попробуйте запустить gunicorn вручную от пользователя deploy:

```bash
su - deploy
cd ~/sofa-marketplace/backend
source venv/bin/activate
gunicorn --config gunicorn_config.py config.wsgi:application
```

Это покажет реальную ошибку, которая мешает запуску.
