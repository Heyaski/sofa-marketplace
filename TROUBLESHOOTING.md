# Решение проблем при деплое

## Проблема: Ошибка запуска systemd сервиса

Если при запуске сервиса возникает ошибка:

```bash
sudo systemctl start sofa-backend
# Job for sofa-backend.service failed because the control process exited with error code.
```

### Шаг 1: Проверьте статус сервиса

```bash
sudo systemctl status sofa-backend.service
```

Это покажет краткую информацию об ошибке.

### Шаг 2: Проверьте подробные логи

```bash
sudo journalctl -xeu sofa-backend.service -n 50
```

Или для просмотра в реальном времени:

```bash
sudo journalctl -xeu sofa-backend.service -f
```

### Шаг 3: Типичные проблемы и решения

#### Проблема 1: Неправильные пути в systemd файле

**Симптом:** `No such file or directory` или `WorkingDirectory`

**Решение:**

1. Проверьте файл сервиса:

```bash
sudo nano /etc/systemd/system/sofa-backend.service
```

2. Убедитесь, что все пути правильные:

   - `WorkingDirectory` должен указывать на `/home/deploy/sofa-marketplace/backend`
   - `ExecStart` должен указывать на правильный путь к gunicorn
   - `User` и `Group` должны быть `deploy`

3. Проверьте, что пути существуют:

```bash
ls -la /home/deploy/sofa-marketplace/backend
ls -la /home/deploy/sofa-marketplace/backend/venv/bin/gunicorn
```

#### Проблема 2: Отсутствие прав доступа

**Симптом:** `Permission denied`

**Решение:**

```bash
# Убедитесь, что пользователь deploy владеет файлами
sudo chown -R deploy:deploy /home/deploy/sofa-marketplace

# Проверьте права на исполняемые файлы
chmod +x /home/deploy/sofa-marketplace/backend/venv/bin/gunicorn
```

#### Проблема 3: Виртуальное окружение не активируется

**Симптом:** `ModuleNotFoundError` или `gunicorn: command not found`

**Решение:**

1. Проверьте, что виртуальное окружение создано:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
which gunicorn
```

2. Если gunicorn не установлен:

```bash
source venv/bin/activate
pip install gunicorn
```

3. В systemd файле используйте полный путь к gunicorn:

```ini
ExecStart=/home/deploy/sofa-marketplace/backend/venv/bin/gunicorn \
    --config gunicorn_config.py \
    config.wsgi:application
```

#### Проблема 4: Ошибки в Django (отсутствует .env, неправильная БД)

**Симптом:** `ImproperlyConfigured` или ошибки подключения к БД

**Решение:**

1. Проверьте наличие .env файла:

```bash
ls -la /home/deploy/sofa-marketplace/backend/.env
```

2. Проверьте содержимое .env:

```bash
cat /home/deploy/sofa-marketplace/backend/.env
```

3. Проверьте подключение к БД вручную:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
python manage.py check --database default
```

#### Проблема 5: Порт уже занят

**Симптом:** `Address already in use`

**Решение:**

```bash
# Проверьте, что использует порт 8000
sudo netstat -tulpn | grep 8000
# или
sudo lsof -i :8000

# Если порт занят, либо остановите процесс, либо измените порт в gunicorn_config.py
```

#### Проблема 6: Отсутствует файл gunicorn_config.py

**Симптом:** `No such file or directory: gunicorn_config.py`

**Решение:**

1. Создайте файл конфигурации:

```bash
cd /home/deploy/sofa-marketplace/backend
nano gunicorn_config.py
```

2. Добавьте содержимое (см. инструкцию в DEPLOY_VPS.md)

### Шаг 4: Проверка конфигурации systemd

После исправления проблем:

```bash
# Перезагрузите конфигурацию systemd
sudo systemctl daemon-reload

# Попробуйте запустить снова
sudo systemctl start sofa-backend

# Проверьте статус
sudo systemctl status sofa-backend
```

### Шаг 5: Ручной запуск для отладки

Если проблема не решается, попробуйте запустить вручную:

```bash
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
gunicorn --config gunicorn_config.py config.wsgi:application
```

Это покажет ошибки напрямую в терминале.

### Шаг 6: Проверка прав на файлы логов

```bash
# Создайте директорию для логов
mkdir -p /home/deploy/sofa-marketplace/backend/logs

# Установите права
chmod 755 /home/deploy/sofa-marketplace/backend/logs
chown deploy:deploy /home/deploy/sofa-marketplace/backend/logs
```

---

## Быстрая диагностика

Выполните эти команды для быстрой диагностики:

```bash
# 1. Статус сервиса
sudo systemctl status sofa-backend

# 2. Логи
sudo journalctl -xeu sofa-backend.service -n 50

# 3. Проверка путей
ls -la /home/deploy/sofa-marketplace/backend/venv/bin/gunicorn
ls -la /home/deploy/sofa-marketplace/backend/gunicorn_config.py
ls -la /home/deploy/sofa-marketplace/backend/.env

# 4. Проверка прав
ls -la /home/deploy/sofa-marketplace/backend/

# 5. Ручной запуск
cd /home/deploy/sofa-marketplace/backend
source venv/bin/activate
python manage.py check
gunicorn --config gunicorn_config.py config.wsgi:application
```
