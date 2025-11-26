# Исправление ошибки 403 Forbidden для статики

## Проблема

```
GET https://api.vizhub.art/static/admin/css/base.css 403 (Forbidden)
```

Это означает, что Nginx находит файл, но не может его прочитать из-за прав доступа.

## Решение

### Шаг 1: Проверка прав доступа

```bash
# Проверьте текущие права
ls -la ~/sofa-marketplace/backend/staticfiles/
ls -la ~/sofa-marketplace/backend/staticfiles/admin/
```

### Шаг 2: Исправление прав доступа

```bash
# Установите правильные права на директорию staticfiles
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles

# Убедитесь, что все файлы читаемы
sudo find ~/sofa-marketplace/backend/staticfiles -type f -exec chmod 644 {} \;
sudo find ~/sofa-marketplace/backend/staticfiles -type d -exec chmod 755 {} \;
```

### Шаг 3: Проверка прав Nginx

Nginx обычно работает от имени пользователя `www-data` или `nginx`. Проверьте:

```bash
# Проверьте, от какого пользователя работает Nginx
ps aux | grep nginx

# Или проверьте конфигурацию
sudo cat /etc/nginx/nginx.conf | grep user
```

### Шаг 4: Настройка прав для Nginx

**Вариант А: Дать Nginx доступ к файлам (рекомендуется)**

```bash
# Добавьте пользователя Nginx в группу deploy (если нужно)
sudo usermod -a -G deploy www-data  # или nginx

# Или дайте права на чтение всем
sudo chmod -R o+r ~/sofa-marketplace/backend/staticfiles
sudo chmod -R o+X ~/sofa-marketplace/backend/staticfiles
```

**Вариант Б: Изменить владельца на www-data (альтернатива)**

```bash
# Измените владельца на пользователя Nginx
sudo chown -R www-data:www-data ~/sofa-marketplace/backend/staticfiles
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles
```

Но тогда нужно будет запускать collectstatic от имени root или через sudo.

### Шаг 5: Проверка SELinux (если используется)

Если на сервере включен SELinux, это может блокировать доступ:

```bash
# Проверьте статус SELinux
getenforce

# Если включен, временно отключите для теста (не рекомендуется для продакшена)
# sudo setenforce 0

# Или установите правильный контекст
sudo chcon -R -t httpd_sys_content_t ~/sofa-marketplace/backend/staticfiles/
```

### Шаг 6: Перезагрузка Nginx

```bash
sudo systemctl reload nginx
```

### Шаг 7: Проверка

Попробуйте снова открыть в браузере:

```
https://api.vizhub.art/static/admin/css/base.css
```

## Быстрое решение (все команды сразу)

```bash
# Исправление прав доступа
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
sudo find ~/sofa-marketplace/backend/staticfiles -type f -exec chmod 644 {} \;
sudo find ~/sofa-marketplace/backend/staticfiles -type d -exec chmod 755 {} \;
sudo chmod -R o+r ~/sofa-marketplace/backend/staticfiles

# Перезагрузка Nginx
sudo systemctl reload nginx

# Проверка
curl -I https://api.vizhub.art/static/admin/css/base.css
```

Должен вернуться статус 200 OK, а не 403.

## Альтернативное решение: Использовать WhiteNoise

Если проблемы с правами продолжаются, можно использовать WhiteNoise для обслуживания статики:

1. Убедитесь, что WhiteNoise включен в `settings.py`
2. Уберите блок `/static/` из конфигурации Nginx
3. WhiteNoise будет обслуживать статику через Django

Но это менее эффективно, чем Nginx для статики.

