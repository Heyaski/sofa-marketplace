# Скрипты и конфигурации для деплоя

Эта папка содержит вспомогательные файлы для развертывания проекта на VPS сервере.

## Скрипты

### `install.sh`

Автоматическая установка всех необходимых зависимостей на сервере:

- Python 3 и pip
- Node.js и npm
- Nginx
- Certbot
- Git и другие утилиты

> **Примечание:** SQLite встроен в Python, отдельная установка БД не требуется.

**Использование:**

```bash
sudo bash deploy/install.sh
```

### `setup-firewall.sh`

Настройка UFW firewall с разрешением SSH, HTTP и HTTPS.

**Использование:**

```bash
sudo bash deploy/setup-firewall.sh
```

### `update.sh`

Обновление проекта на сервере: обновление кода, зависимостей, миграций и перезапуск сервисов.

**Использование:**

```bash
bash deploy/update.sh
```

### `backup.sh`

Создание резервной копии базы данных SQLite и медиа файлов.

**Использование:**

```bash
bash deploy/backup.sh
```

## Конфигурационные файлы

### `nginx-frontend.conf.example`

Пример конфигурации Nginx для фронтенда (основной домен).

**Использование:**

1. Скопируйте в `/etc/nginx/sites-available/sofa-frontend`
2. Замените `yourdomain.com` на ваш домен
3. Создайте символическую ссылку в `sites-enabled`

### `nginx-api.conf.example`

Пример конфигурации Nginx для API (поддомен api).

**Использование:**

1. Скопируйте в `/etc/nginx/sites-available/sofa-api`
2. Замените `yourdomain.com` на ваш домен
3. Замените `/home/deploy` на путь к вашему проекту
4. Создайте символическую ссылку в `sites-enabled`

### `systemd-backend.service.example`

Пример systemd сервиса для Django Backend.

**Использование:**

1. Скопируйте в `/etc/systemd/system/sofa-backend.service`
2. Замените `/home/deploy` на путь к вашему проекту
3. Замените `deploy` на вашего пользователя
4. Выполните `sudo systemctl daemon-reload`

### `systemd-frontend.service.example`

Пример systemd сервиса для Next.js Frontend.

**Использование:**

1. Скопируйте в `/etc/systemd/system/sofa-frontend.service`
2. Замените `/home/deploy` на путь к вашему проекту
3. Замените `deploy` на вашего пользователя
4. Выполните `sudo systemctl daemon-reload`

## Порядок использования

1. **Установка зависимостей:** `sudo bash deploy/install.sh`
2. **Настройка firewall:** `sudo bash deploy/setup-firewall.sh`
   > **Примечание:** SQLite не требует настройки, база данных создастся автоматически при первом запуске миграций.
3. **Настройка конфигураций:** скопируйте и отредактируйте примеры конфигураций
4. **Регулярные обновления:** `bash deploy/update.sh`
5. **Регулярные бэкапы:** `bash deploy/backup.sh` (можно добавить в cron)

## Примечания

- Все скрипты должны быть исполняемыми: `chmod +x deploy/*.sh`
- Скрипты, требующие root прав, должны запускаться с `sudo`
- Перед использованием проверьте и обновите пути в конфигурационных файлах
- Рекомендуется настроить автоматический запуск скрипта бэкапа через cron
