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

## 2. CORS — картинки с api.vizhub.pro блокируются с www.vizhub.pro

Ошибка: `Access to fetch at 'https://api.vizhub.pro/media/...' has been blocked by CORS policy`

**Решение:** в nginx для API в `location /media/` и `location /static/` должен быть правильный домен.

Проверь файл:
```bash
sudo nano /etc/nginx/sites-available/sofa-api
```

В блоках `location /media/` и `location /static/` замени:

```
add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
```

на:

```
add_header 'Access-Control-Allow-Origin' 'https://www.vizhub.pro' always;
```

Или для поддержки обоих доменов (vizhub.pro и www.vizhub.pro) используй:

```
add_header 'Access-Control-Allow-Origin' '*' always;
```

Перезагрузи nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Проверка

После изменений:
- Оплата подписки через ЮКассу должна работать
- Изображения товаров должны загружаться с api.vizhub.pro
