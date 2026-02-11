# Исправление ЮКассы и CORS для vizhub.pro

## 1. ЮКасса — ключи не настроены

Ошибка: `YOOKASSA_ACCOUNT_ID и YOOKASSA_SECRET_KEY должны быть настроены`

**Решение:** добавь ключи в `.env` на сервере:

```bash
nano ~/sofa-marketplace/backend/.env
```

Добавь или обнови строки (подставь свои значения из личного кабинета ЮКассы):

```
YOOKASSA_ACCOUNT_ID=твой_account_id
YOOKASSA_SECRET_KEY=твой_secret_key
YOOKASSA_TEST_MODE=1
```

Для продакшена: `YOOKASSA_TEST_MODE=0`

Перезапусти backend:
```bash
sudo systemctl restart sofa-backend
```

---

## 2. CORS — картинки и 3D модели с api.vizhub.pro блокируются с www.vizhub.pro

Ошибка: `Access to fetch at 'https://api.vizhub.pro/media/...' has been blocked by CORS policy`  
Или: `Access to fetch at 'https://api.vizhub.pro/media/assets/диван00087.glb' ... No 'Access-Control-Allow-Origin' header`

**Причина:** Nginx раздаёт медиа напрямую, CORS нужно настроить в nginx, а не в Django.

**Решение:** в конфиге nginx в `location /media/` и `location /static/` добавь (или проверь наличие):

```
add_header 'Access-Control-Allow-Origin' 'https://www.vizhub.pro' always;
add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
```

Если конфиг в `/etc/nginx/sites-available/sofa-api`:

```bash
sudo nano /etc/nginx/sites-available/sofa-api
```

Для обоих доменов используй:

```
add_header 'Access-Control-Allow-Origin' '*' always;
```

Перезагрузи nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Excel HYPERLINK — 404 для фото из file://

Ошибка: `Failed to load resource: /=HYPERLINK("file:/E:/VizHub/...")`

**Причина:** в Excel в столбце фото стоят формулы `=HYPERLINK("file:/путь", "имя")`. Локальные пути `file://` не работают в браузере.

**Что сделано:**
- При импорте Excel такие значения в `photo_url` теперь игнорируются.
- Для уже загруженных товаров: в админке «Товары» → выбрать товары → действие «Очистить невалидные photo_url» → применить.

## 4. Проверка

После изменений:
- Оплата подписки через ЮКассу должна работать
- Изображения и 3D модели должны загружаться с api.vizhub.pro
