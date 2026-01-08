# 🌐 Руководство по смене адреса сайта

Это руководство поможет вам изменить адрес сайта с `vizhub.art` на новый домен.

## 📋 Список файлов для изменения

### 1. **Backend (Django) - Переменные окружения**

#### Файл: `backend/.env`

```bash
# Замените старые домены на новые
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com

# Если используете S3 хранилище, обновите custom domain (если нужно)
AWS_S3_CUSTOM_DOMAIN=your-bucket.s3.beget.com
```

**Важно:** 
- `ALLOWED_HOSTS` указывается через запятую **БЕЗ кавычек**
- Пример: `ALLOWED_HOSTS=example.com,www.example.com,api.example.com` ✅
- Неправильно: `ALLOWED_HOSTS="example.com,www.example.com"` ❌

---

### 2. **Backend (Django) - Настройки CORS**

#### Файл: `backend/config/settings.py`

Если в продакшене нужно ограничить CORS (сейчас установлено `CORS_ALLOW_ALL_ORIGINS = True`), замените строку 62:

```python
# Для разработки (текущая настройка)
CORS_ALLOW_ALL_ORIGINS = True

# Для продакшена (замените на ваш домен)
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
]
```

---

### 3. **Frontend (Next.js) - Переменные окружения**

#### Файл: `frontend/.env.local` или `frontend/.env.production`

```bash
# URL API бэкенда
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Название приложения (опционально)
NEXT_PUBLIC_APP_NAME=Your App Name
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**Важно:** После изменения переменных окружения нужно пересобрать фронтенд:
```bash
cd frontend
npm run build
```

---

### 4. **Frontend (Next.js) - Конфигурация изображений**

#### Файл: `frontend/next.config.js`

Замените строки 38-45:

```javascript
// Удалите или замените старый домен
{
    protocol: 'https',
    hostname: 'api.vizhub.art',  // ← ЗАМЕНИТЕ НА ВАШ ДОМЕН
    pathname: '/media/**',
},
```

На новый:

```javascript
{
    protocol: 'https',
    hostname: 'api.yourdomain.com',  // ← ВАШ НОВЫЙ ДОМЕН
    pathname: '/media/**',
},
```

---

### 5. **Nginx - Конфигурация API**

#### Файл: `/etc/nginx/sites-available/sofa-api` (или ваш файл конфигурации)

Замените `server_name` и CORS заголовки:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # ← ЗАМЕНИТЕ

    # ... остальные настройки ...

    location /static/ {
        # ... настройки ...
        add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;  # ← ЗАМЕНИТЕ
    }

    location /media/ {
        # ... настройки ...
        add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;  # ← ЗАМЕНИТЕ
    }
}
```

**Важно:** Если используете SSL, добавьте блок для HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # ... остальные настройки ...
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

### 6. **Nginx - Конфигурация Frontend**

#### Файл: `/etc/nginx/sites-available/sofa-frontend` (или ваш файл конфигурации)

Замените `server_name`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # ← ЗАМЕНИТЕ

    # ... остальные настройки ...
}
```

---

### 7. **S3 хранилище (если используется)**

#### В панели управления Beget (или вашего S3 провайдера)

1. Откройте настройки бакета
2. Перейдите в раздел **"Настройки CORS"**
3. Обновите правила CORS, заменив `https://vizhub.art` на `https://yourdomain.com`

Пример правила CORS:
```
Origin: https://yourdomain.com
Разрешенные HTTP-методы: GET, HEAD
Разрешенные заголовки: *
Время кэширования CORS: 3600
```

---

### 8. **DNS настройки**

Убедитесь, что в DNS настроены следующие записи:

```
A запись:
yourdomain.com → IP адрес сервера
www.yourdomain.com → IP адрес сервера
api.yourdomain.com → IP адрес сервера

Или CNAME записи (если используете CDN):
www.yourdomain.com → yourdomain.com
api.yourdomain.com → yourdomain.com
```

---

## 🔄 Порядок действий

1. **Обновите переменные окружения:**
   - `backend/.env` - `ALLOWED_HOSTS`
   - `frontend/.env.production` - `NEXT_PUBLIC_API_URL`

2. **Обновите конфигурационные файлы:**
   - `frontend/next.config.js` - домен для изображений
   - Nginx конфигурации - `server_name` и CORS заголовки

3. **Обновите настройки S3** (если используется):
   - CORS правила в панели управления

4. **Пересоберите фронтенд:**
   ```bash
   cd frontend
   npm run build
   ```

5. **Перезапустите сервисы:**
   ```bash
   # Backend
   sudo systemctl restart sofa-backend
   # или
   python manage.py runserver  # для разработки

   # Frontend
   sudo systemctl restart sofa-frontend
   # или
   npm run dev  # для разработки

   # Nginx
   sudo nginx -t  # проверка конфигурации
   sudo systemctl reload nginx
   ```

6. **Проверьте работу:**
   - Откройте сайт: `https://yourdomain.com`
   - Проверьте API: `https://api.yourdomain.com/api/`
   - Проверьте загрузку файлов и изображений

---

## ✅ Чеклист

- [ ] Обновлен `backend/.env` - `ALLOWED_HOSTS`
- [ ] Обновлен `frontend/.env.production` - `NEXT_PUBLIC_API_URL`
- [ ] Обновлен `frontend/next.config.js` - домен для изображений
- [ ] Обновлена конфигурация Nginx для API - `server_name` и CORS
- [ ] Обновлена конфигурация Nginx для Frontend - `server_name`
- [ ] Обновлены CORS правила в S3 (если используется)
- [ ] Пересобран фронтенд (`npm run build`)
- [ ] Перезапущены все сервисы
- [ ] Проверена работа сайта и API
- [ ] Проверена загрузка файлов и изображений

---

## 🚨 Важные замечания

1. **SSL сертификаты:** Если используете HTTPS, убедитесь, что SSL сертификаты настроены для нового домена

2. **Кеш браузера:** После смены домена очистите кеш браузера или используйте режим инкогнито

3. **Старые ссылки:** Если на старом домене были опубликованы ссылки, настройте редирект со старого домена на новый

4. **Email адреса:** Если в коде есть упоминания email адресов (например, `support@vizhub.art`), их также нужно обновить:
   - `backend/apps/pages/management/commands/import_existing_pages.py`
   - `policy.txt`
   - Другие файлы с email адресами

5. **Название бренда:** Если нужно изменить название "VIZHUB.ART" на другое, обновите:
   - `backend/config/settings.py` - настройки Jazzmin (строки 295-297, 361)
   - `frontend/src/app/layout.tsx` - title страницы
   - `frontend/src/components/Header.tsx` - название в шапке
   - `frontend/src/components/Footer.tsx` - название в футере

---

## 📞 Поддержка

Если возникли проблемы после смены домена, проверьте:
- Логи Nginx: `sudo tail -f /var/log/nginx/error.log`
- Логи Django: `sudo journalctl -u sofa-backend -f`
- Логи Next.js: `sudo journalctl -u sofa-frontend -f`
- Консоль браузера (F12) на наличие CORS ошибок



