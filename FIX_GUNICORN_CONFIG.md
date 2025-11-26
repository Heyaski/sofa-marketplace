# Исправление ошибки: gunicorn_config.py не существует

## Проблема

```
Error: 'gunicorn_config.py' doesn't exist
```

## Решение

### Вариант 1: Создать файл на сервере (быстро)

Выполните на сервере:

```bash
cd ~/sofa-marketplace/backend
nano gunicorn_config.py
```

Вставьте следующее содержимое:

```python
# Конфигурация Gunicorn для продакшена
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
user = "deploy"
group = "deploy"
pidfile = "/home/deploy/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
errorlog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
loglevel = "info"
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

### Вариант 2: Скопировать из примера

```bash
cd ~/sofa-marketplace/backend

# Если есть пример файла
cp gunicorn_config.py.example gunicorn_config.py

# Отредактируйте файл, заменив пути
nano gunicorn_config.py
```

### Вариант 3: Создать через echo (одной командой)

```bash
cat > ~/sofa-marketplace/backend/gunicorn_config.py << 'EOF'
# Конфигурация Gunicorn для продакшена
bind = "127.0.0.1:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
user = "deploy"
group = "deploy"
pidfile = "/home/deploy/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/deploy/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/deploy/sofa-marketplace/backend/logs/error.log"
loglevel = "info"
EOF
```

## Проверка и запуск

```bash
# Проверьте, что файл создан
ls -la ~/sofa-marketplace/backend/gunicorn_config.py

# Убедитесь, что директория для логов существует
mkdir -p ~/sofa-marketplace/backend/logs

# Перезапустите сервис
sudo systemctl restart sofa-backend

# Проверьте статус
sudo systemctl status sofa-backend
```

## Если используете другого пользователя

Если вы используете не `deploy`, а другого пользователя (например, `ваш_логин`), замените в файле:

```python
user = "ваш_логин"
group = "ваш_логин"
pidfile = "/home/ваш_логин/sofa-marketplace/backend/gunicorn.pid"
accesslog = "/home/ваш_логин/sofa-marketplace/backend/logs/access.log"
errorlog = "/home/ваш_логин/sofa-marketplace/backend/logs/error.log"
```

## Проверка работы

После создания файла и перезапуска проверьте:

```bash
# Статус сервиса
sudo systemctl status sofa-backend

# Логи
tail -f ~/sofa-marketplace/backend/logs/error.log

# Проверка, что Gunicorn слушает порт
sudo netstat -tulpn | grep 8000
```
