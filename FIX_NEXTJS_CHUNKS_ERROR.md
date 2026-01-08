# 🔧 Исправление ошибки загрузки Next.js chunks

## Проблема

Ошибка `ChunkLoadError: Loading chunk 763 failed` с кодом 400 (Bad Request). Сайт загружается на секунду, затем появляется белая страница.

## Причины

1. **Несоответствие версий chunks** - старые chunks остались после пересборки
2. **Проблемы с кешированием** - браузер пытается загрузить старые chunks
3. **Неправильная конфигурация Nginx** - статика Next.js не обслуживается правильно
4. **Next.js не пересобран** после изменений

## Решение

### Шаг 1: Пересоберите Next.js приложение

```bash
cd ~/sofa-marketplace/frontend

# Остановите Next.js сервер
sudo systemctl stop sofa-frontend
# или если запущен вручную: pkill -f "next start"

# Очистите старую сборку
rm -rf .next
rm -rf node_modules/.cache

# Пересоберите проект
npm run build

# Проверьте, что сборка прошла успешно
ls -la .next/static/chunks/
```

### Шаг 2: Обновите конфигурацию Nginx для фронтенда

Убедитесь, что Nginx правильно проксирует все запросы к Next.js, включая статические файлы `/_next/`.

Откройте конфигурацию:

```bash
sudo nano /etc/nginx/sites-available/sofa-frontend
```

**Правильная конфигурация для Next.js:**

```nginx
server {
    listen 80;
    server_name vizhub.pro www.vizhub.pro;

    # Если используете HTTPS, добавьте блок для порта 443
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/vizhub.pro/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/vizhub.pro/privkey.pem;

    # Увеличиваем размер загружаемых файлов (если нужно)
    client_max_body_size 100M;

    # ВАЖНО: Все запросы, включая /_next/, должны идти к Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket поддержка
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Заголовки
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Отключаем кеширование для HTML (чтобы всегда получать свежие chunks)
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Опционально: можно добавить отдельную обработку для статики Next.js
    # Но обычно это не нужно, так как Next.js сам обслуживает /_next/
    # location /_next/static/ {
    #     proxy_pass http://127.0.0.1:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    #     
    #     # Кеширование для статики (30 дней)
    #     expires 30d;
    #     add_header Cache-Control "public, immutable";
    # }
}
```

**Важно:** В Next.js standalone режиме все запросы (включая `/_next/static/`) должны проксироваться к Next.js серверу на порту 3000. Не нужно настраивать отдельные location блоки для `/_next/`.

### Шаг 3: Проверьте конфигурацию Nginx

```bash
# Проверьте синтаксис
sudo nginx -t

# Если есть ошибки, исправьте их
# Затем перезагрузите Nginx
sudo systemctl reload nginx
```

### Шаг 4: Перезапустите Next.js

```bash
# Если используете systemd
sudo systemctl restart sofa-frontend
sudo systemctl status sofa-frontend

# Или если запускаете вручную
cd ~/sofa-marketplace/frontend
NODE_ENV=production PORT=3000 node_modules/.bin/next start
```

### Шаг 5: Очистите кеш браузера

**В браузере:**
1. Откройте DevTools (F12)
2. Правый клик на кнопку обновления
3. Выберите "Очистить кеш и жесткая перезагрузка"
4. Или используйте Ctrl+Shift+R (Windows/Linux) / Cmd+Shift+R (Mac)

**Или в режиме инкогнито:**
- Откройте сайт в режиме инкогнито/приватном режиме

### Шаг 6: Проверьте логи

```bash
# Логи Next.js (если используете systemd)
sudo journalctl -u sofa-frontend -f

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## Альтернативное решение: Если проблема сохраняется

### Вариант 1: Полная очистка и пересборка

```bash
cd ~/sofa-marketplace/frontend

# Остановите сервер
sudo systemctl stop sofa-frontend

# Полная очистка
rm -rf .next
rm -rf node_modules/.cache
rm -rf out
rm -rf .next/cache

# Переустановите зависимости (опционально)
# rm -rf node_modules
# npm install

# Пересоберите
npm run build

# Запустите
sudo systemctl start sofa-frontend
```

### Вариант 2: Проверьте переменные окружения

Убедитесь, что в `frontend/.env.production` указаны правильные настройки:

```bash
cd ~/sofa-marketplace/frontend
cat .env.production
```

Должно быть что-то вроде:

```env
NEXT_PUBLIC_API_URL=https://api.vizhub.pro
NEXT_PUBLIC_APP_NAME=VizHub.art
NODE_ENV=production
```

### Вариант 3: Проверьте права доступа

```bash
# Убедитесь, что у пользователя есть права на директорию .next
cd ~/sofa-marketplace/frontend
ls -la .next/

# Если нужно, исправьте права
sudo chown -R deploy:deploy .next/
sudo chmod -R 755 .next/
```

### Вариант 4: Проверьте, что Next.js запущен

```bash
# Проверьте, что процесс Next.js запущен
ps aux | grep next

# Проверьте, что порт 3000 слушается
sudo netstat -tlnp | grep 3000
# или
sudo ss -tlnp | grep 3000

# Проверьте доступность локально
curl http://127.0.0.1:3000
```

---

## Проверка работы

После исправления:

1. **Откройте сайт в браузере** (с очищенным кешем)
2. **Откройте DevTools (F12)** → вкладка Network
3. **Проверьте загрузку chunks:**
   - Должны загружаться файлы из `/_next/static/chunks/`
   - Статус должен быть 200 (не 400)
   - Не должно быть ошибок ChunkLoadError

4. **Проверьте консоль браузера:**
   - Не должно быть ошибок загрузки chunks
   - Не должно быть React ошибок

---

## Дополнительные настройки для production

### Отключение кеширования для HTML (опционально)

Если проблема с кешированием сохраняется, можно добавить в Nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    # ... остальные настройки ...
    
    # Отключаем кеширование для HTML
    proxy_set_header Cache-Control "no-cache, no-store, must-revalidate";
    proxy_set_header Pragma "no-cache";
    proxy_set_header Expires "0";
}

# Но кешируем статику Next.js
location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    # Кеширование для статики (30 дней)
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## Если ничего не помогает

1. **Проверьте версию Next.js:**
   ```bash
   cd ~/sofa-marketplace/frontend
   npm list next
   ```

2. **Проверьте, что используется правильный режим сборки:**
   - В `next.config.js` должно быть `output: 'standalone'`
   - Это означает, что Next.js сам обслуживает всю статику

3. **Попробуйте запустить Next.js в режиме разработки** (для теста):
   ```bash
   cd ~/sofa-marketplace/frontend
   npm run dev
   ```
   Если в dev режиме все работает, проблема в production сборке.

4. **Проверьте логи Next.js на наличие ошибок:**
   ```bash
   sudo journalctl -u sofa-frontend -n 100
   ```

---

**Готово!** После выполнения этих шагов проблема с загрузкой chunks должна быть решена.



