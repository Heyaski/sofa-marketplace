# Исправление ошибки Permission denied в Nginx

## Проблема

```
[error] open() "/home/deploy/sofa-marketplace/backend/staticfiles/..." failed (13: Permission denied)
```

Ошибка 13 означает, что Nginx (пользователь `www-data`) не может читать файлы в директории `staticfiles`.

## Быстрое решение

Выполните на сервере:

```bash
# 1. Убедитесь, что директория staticfiles существует
ls -la ~/sofa-marketplace/backend/staticfiles

# 2. Установите правильные права доступа
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles

# 3. Убедитесь, что родительские директории доступны для чтения
sudo chmod o+x /home
sudo chmod o+x /home/deploy
sudo chmod o+x /home/deploy/sofa-marketplace
sudo chmod o+x /home/deploy/sofa-marketplace/backend

# 4. Проверьте, что nginx может читать файлы
sudo -u www-data ls ~/sofa-marketplace/backend/staticfiles/admin/js/vendor/jquery/jquery.js

# 5. Перезагрузите Nginx
sudo systemctl reload nginx
```

## Подробное решение

### Шаг 1: Проверьте текущие права доступа

```bash
# Проверьте права на директорию staticfiles
ls -la ~/sofa-marketplace/backend/ | grep staticfiles

# Проверьте права на файлы внутри
ls -la ~/sofa-marketplace/backend/staticfiles/admin/js/vendor/jquery/ | head -5
```

### Шаг 2: Установите правильного владельца

```bash
# Убедитесь, что deploy владеет файлами
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles
```

### Шаг 3: Установите правильные права доступа

```bash
# Установите права: владелец (rwx), группа (rx), другие (rx)
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles
```

Это означает:
- Владелец (deploy): читать, писать, выполнять (7)
- Группа (deploy): читать, выполнять (5)
- Другие (включая www-data): читать, выполнять (5)

### Шаг 4: Проверьте права на родительские директории

Nginx должен иметь права на **выполнение** (x) для всех родительских директорий:

```bash
# Проверьте права на родительские директории
ls -ld /home
ls -ld /home/deploy
ls -ld /home/deploy/sofa-marketplace
ls -ld /home/deploy/sofa-marketplace/backend

# Если нет прав на выполнение, установите их
sudo chmod o+x /home
sudo chmod o+x /home/deploy
sudo chmod o+x /home/deploy/sofa-marketplace
sudo chmod o+x /home/deploy/sofa-marketplace/backend
```

### Шаг 5: Проверьте, что nginx может читать файлы

```bash
# Попробуйте прочитать файл от имени пользователя nginx
sudo -u www-data cat ~/sofa-marketplace/backend/staticfiles/admin/js/vendor/jquery/jquery.js | head -1
```

Если это не работает, проверьте права еще раз.

### Шаг 6: Альтернативное решение - добавьте www-data в группу deploy

Если проблема сохраняется:

```bash
# Добавьте www-data в группу deploy
sudo usermod -a -G deploy www-data

# Перезапустите Nginx
sudo systemctl restart nginx
```

### Шаг 7: Проверьте конфигурацию Nginx

Убедитесь, что в конфигурации Nginx правильно указан путь:

```bash
sudo cat /etc/nginx/sites-available/sofa-api | grep -A 3 "location /static/"
```

Должно быть:

```nginx
location /static/ {
    alias /home/deploy/sofa-marketplace/backend/staticfiles/;
}
```

**Важно:** Путь должен заканчиваться на `/` в `alias`.

### Шаг 8: Перезагрузите Nginx

```bash
# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

## Проверка после исправления

```bash
# Проверьте логи - ошибок быть не должно
sudo tail -f /var/log/nginx/error.log

# Попробуйте открыть файл в браузере
curl -I https://api.vizhub.pro/static/admin/js/vendor/jquery/jquery.js
```

## Если проблема сохраняется

### Вариант 1: Используйте более открытые права (не рекомендуется для продакшена)

```bash
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles
sudo chmod -R o+r ~/sofa-marketplace/backend/staticfiles
```

### Вариант 2: Измените пользователя Nginx (не рекомендуется)

```bash
# Отредактируйте конфигурацию Nginx
sudo nano /etc/nginx/nginx.conf

# Измените user на deploy
user deploy;

# Перезапустите Nginx
sudo systemctl restart nginx
```

**Внимание:** Это менее безопасно, так как Nginx будет работать от имени пользователя deploy.

### Вариант 3: Используйте символические ссылки в /var/www

```bash
# Создайте директорию в /var/www
sudo mkdir -p /var/www/sofa-static
sudo chown -R deploy:www-data /var/www/sofa-static
sudo chmod -R 755 /var/www/sofa-static

# Скопируйте или создайте символическую ссылку
sudo -u deploy cp -r ~/sofa-marketplace/backend/staticfiles/* /var/www/sofa-static/

# Обновите конфигурацию Nginx
sudo nano /etc/nginx/sites-available/sofa-api
```

Измените:
```nginx
location /static/ {
    alias /var/www/sofa-static/;
}
```

## Автоматическое исправление

Создайте скрипт для автоматического исправления:

```bash
#!/bin/bash
# fix-static-permissions.sh

echo "Исправление прав доступа для staticfiles..."

# Установка владельца
sudo chown -R deploy:deploy ~/sofa-marketplace/backend/staticfiles

# Установка прав
sudo chmod -R 755 ~/sofa-marketplace/backend/staticfiles

# Права на родительские директории
sudo chmod o+x /home
sudo chmod o+x /home/deploy
sudo chmod o+x /home/deploy/sofa-marketplace
sudo chmod o+x /home/deploy/sofa-marketplace/backend

# Перезагрузка Nginx
sudo systemctl reload nginx

echo "Готово! Проверьте логи: sudo tail -f /var/log/nginx/error.log"
```

Сохраните как `fix-static-permissions.sh` и выполните:
```bash
chmod +x fix-static-permissions.sh
./fix-static-permissions.sh
```
