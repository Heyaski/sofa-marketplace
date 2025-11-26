# Диагностика 403 Forbidden в Nginx

## Проверка конфигурации Nginx

```bash
# Проверьте конфигурацию для /static/
sudo cat /etc/nginx/sites-available/sofa-api | grep -A 10 "location /static/"
```

## Проверка существования файлов

```bash
# Проверьте, что файл действительно существует
ls -la ~/sofa-marketplace/backend/staticfiles/admin/css/base.css

# Проверьте структуру директорий
ls -la ~/sofa-marketplace/backend/staticfiles/
```

## Проверка логов Nginx

```bash
# Посмотрите логи ошибок
sudo tail -20 /var/log/nginx/error.log

# Или в реальном времени
sudo tail -f /var/log/nginx/error.log
```

Затем попробуйте снова открыть файл в браузере и посмотрите, что появится в логах.

## Возможные проблемы

### Проблема 1: Неправильный путь в конфигурации

Убедитесь, что в конфигурации Nginx путь правильный и заканчивается на `/`:

```nginx
location /static/ {
    alias /home/deploy/sofa-marketplace/backend/staticfiles/;  # Обратите внимание на / в конце
}
```

### Проблема 2: SELinux блокирует доступ

```bash
# Проверьте статус SELinux
getenforce

# Если включен, установите правильный контекст
sudo chcon -R -t httpd_sys_content_t ~/sofa-marketplace/backend/staticfiles/
```

### Проблема 3: AppArmor блокирует доступ (Ubuntu)

```bash
# Проверьте статус AppArmor
sudo aa-status | grep nginx

# Если есть профиль для nginx, возможно нужно добавить путь
```

### Проблема 4: Проблема с правами на родительские директории

Nginx должен иметь права на чтение всех родительских директорий:

```bash
# Проверьте права на родительские директории
ls -la /home/
ls -la /home/deploy/
ls -la /home/deploy/sofa-marketplace/
ls -la /home/deploy/sofa-marketplace/backend/

# Убедитесь, что все имеют права на выполнение (x)
sudo chmod o+x /home
sudo chmod o+x /home/deploy
sudo chmod o+x /home/deploy/sofa-marketplace
sudo chmod o+x /home/deploy/sofa-marketplace/backend
```

### Проблема 5: Неправильный порядок location блоков

Блок `/static/` должен быть ПЕРЕД блоком `/`:

```nginx
server {
    # Сначала статика
    location /static/ {
        alias /home/deploy/sofa-marketplace/backend/staticfiles/;
    }

    # Потом все остальное
    location / {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

