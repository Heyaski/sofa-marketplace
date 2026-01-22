# Исправление ошибки с директорией логов

## Проблема

```
Error: '/home/deploy/sofa-marketplace/backend/logs/error.log' isn't writable [FileNotFoundError(2, 'No such file or directory')]
```

## Причина

Директория `logs` не существует, и gunicorn не может создать файл логов.

## Решение

Выполните на сервере:

```bash
# 1. Создайте директорию для логов
mkdir -p ~/sofa-marketplace/backend/logs

# 2. Установите правильные права доступа
chmod 755 ~/sofa-marketplace/backend/logs
chown deploy:deploy ~/sofa-marketplace/backend/logs

# 3. Создайте файлы логов (опционально, но рекомендуется)
touch ~/sofa-marketplace/backend/logs/error.log
touch ~/sofa-marketplace/backend/logs/access.log
chmod 644 ~/sofa-marketplace/backend/logs/*.log
chown deploy:deploy ~/sofa-marketplace/backend/logs/*.log

# 4. Перезапустите сервис
sudo systemctl daemon-reload
sudo systemctl restart sofa-backend.service

# 5. Проверьте статус
sudo systemctl status sofa-backend.service
```

## Альтернативное решение: Отключить логирование в файлы

Если вы не хотите использовать файловые логи, можно изменить `gunicorn_config.py`:

```python
# Закомментируйте или удалите строки с errorlog и accesslog
# errorlog = os.path.join(BASE_DIR, 'logs', 'error.log')
# accesslog = os.path.join(BASE_DIR, 'logs', 'access.log')
```

Но лучше создать директорию, так как логи полезны для отладки.

