# Исправление 500 Internal Server Error и CORS

## Две проблемы

1. **500 Internal Server Error** на api.vizhub.pro/admin/ — бэкенд падает при открытии админки  
2. **CORS** — запросы с www.vizhub.org к api.vizhub.pro блокируются браузером (категории, продукты не загружаются)

---

## ⚡ ИСПРАВЛЕНО: `no such column: subscriptions_plan.price_yearly`

**Причина:** Миграции для полей `price_yearly` и `price_yearly_per_month` не применены на сервере.

**Решение — на сервере выполнить:**

```bash
cd ~/sofa-marketplace/backend
source venv/bin/activate
python manage.py migrate
sudo systemctl restart sofa-backend
```

После этого админка должна открываться.

---

## 1. CORS — уже исправлено в коде

В `backend/config/settings.py` добавлены домены:
- `https://www.vizhub.org`
- `https://vizhub.org`

**Если используется `CORS_ALLOW_ALL_ORIGINS = True`** — это уже разрешает все origins, список не важен.

**Если в production отключено** (`CORS_ALLOW_ALL_ORIGINS = False` через переменную окружения) — после деплоя vizhub.org будет в whitelist.

### Nginx — добавить CORS для API (если проксирует Django)

Если Nginx отдаёт ошибки напрямую (минуя Django), он не добавит CORS-заголовки. Проверьте, что запросы к `/api/` идут в Django (proxy_pass), а не обрабатываются Nginx.

Для location `/api/` можно явно добавить (на всякий случай):

```nginx
location /api/ {
    # ... существующие настройки ...
    
    # CORS для preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
        add_header 'Access-Control-Max-Age' 86400;
        return 204;
    }
}
```

**Важно:** CORS обычно обрабатывает Django (django-cors-headers). Ошибки CORS часто появляются, когда **сначала** сервер отдаёт 500 — ответ без заголовка `Access-Control-Allow-Origin` браузер трактует как CORS-ошибку. Поэтому сначала нужно устранить 500.

---

## 2. 500 Internal Server Error — как искать причину

### Шаг 1: Логи Django/Gunicorn

На сервере:

```bash
# Логи gunicorn (systemd)
sudo journalctl -u sofa-backend -n 100 --no-pager

# Или если используется другое имя сервиса
sudo journalctl -u gunicorn -n 100 --no-pager

# Логи в файле (если настроены)
tail -100 /var/log/gunicorn/error.log
```

Ищите traceback с Python-ошибкой.

### Шаг 2: Типичные причины 500 в админке

| Причина | Решение |
|---------|---------|
| **Jazzmin** — конфликт версий | `pip install django-jazzmin --upgrade` или временно убрать из INSTALLED_APPS |
| **adminsortable2** | Обновить: `pip install django-admin-sortable2 --upgrade` |
| **Статика** — 404 на /static/admin/ | `python manage.py collectstatic --noinput` и проверить STATIC_ROOT в Nginx |
| **ALLOWED_HOSTS** | Добавить `api.vizhub.pro` в ALLOWED_HOSTS (через `.env`: `ALLOWED_HOSTS=api.vizhub.pro,www.vizhub.pro,vizhub.pro`) |
| **База данных** | Проверить подключение: `python manage.py check` |
| **Миграции** | `python manage.py migrate` |

### Шаг 3: Проверка напрямую

```bash
cd /path/to/backend
python manage.py check
python manage.py runserver 0.0.0.0:8000
```

Затем в браузере: `http://IP_СЕРВЕРА:8000/admin/`  
Если локально работает, а через Nginx — нет, проблема в Nginx или проксировании.

### Шаг 4: DEBUG (временно)

В `.env` на сервере:
```
DEBUG=1
```

Перезапустить Django и снова открыть `/admin/` — Django покажет полный traceback. **Не забыть вернуть DEBUG=0 после отладки.**

---

## 3. Порядок действий

1. Посмотреть логи → найти точную ошибку (ImportError, AttributeError и т.п.)  
2. Исправить причину 500  
3. Убедиться, что api.vizhub.pro добавлен в ALLOWED_HOSTS  
4. Задеплоить изменения (в т.ч. CORS) и перезапустить бэкенд  
5. Проверить снова: админка открывается, API отвечает, CORS не блокирует запросы с www.vizhub.org  

---

## 4. Быстрая проверка CORS

После деплоя в консоли браузера (F12) на www.vizhub.org:

```javascript
fetch('https://api.vizhub.pro/api/categories/')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Если CORS настроен верно — данные придут. Если нет — будет ошибка CORS.
