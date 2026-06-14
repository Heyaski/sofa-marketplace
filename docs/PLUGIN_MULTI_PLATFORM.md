# Мультиплощадки и одноразовые ссылки активации плагина

## Задача заказчика

1. **Каждое письмо — новая хешированная ссылка** (старые перестают работать).
2. **Несколько баз / площадок** — разные каталоги с разных сайтов или серверов.

## Как это устроено

### Одноразовые токены

| Шаг | Что происходит |
|-----|----------------|
| Оплата / «Отправить повторно» | Генерируется `plain_token`, в БД — только `SHA256(plain_token)` |
| Subdomain | `subdomain_key = token_hash[:32]` → URL `https://{subdomain_key}.vizhub.pro/api` |
| Email | Новый URL + plain-токен (резерв) |
| Старые токены | Помечаются `revoked=True` |
| Активация | `POST /api/plugin/activate-by-token/` `{ "token": "..." }` |
| После активации | Плагин сохраняет `license_hash` для `X-License-Hash` |

Срок: `PLUGIN_ACTIVATION_TOKEN_TTL_HOURS` (по умолчанию 72 ч).

### Несколько площадок (`PluginPlatform`)

В админке Django: **Площадки плагина**.

| Поле | Назначение |
|------|------------|
| `name` | «VizHub», «Partner X» |
| `api_base_url` | `https://api.partner.ru/api` |
| `database_alias` | `default`, `partner_db` — если несколько PostgreSQL на одном Django |
| `is_default` | Площадка по умолчанию |

**Вариант A — отдельные серверы (проще):**  
Каждая площадка = свой VPS + своя БД. В активации приходит список `platforms[]` с разными `api_base_url`. Плагин даёт выбрать площадку в UI.

**Вариант B — один Django, несколько БД:**  
В `settings.DATABASES` добавить `partner_db`, router направляет `Product.objects.using(platform.database_alias)`. Каталог фильтруется по `?platform=slug` или заголовку `X-Plugin-Platform`.

**Вариант C — multi-tenant в одной БД:**  
Поле `Product.platform_id` — одна БД, разные каталоги.

### Nginx (wildcard)

```nginx
server_name ~^(?<sub>[a-f0-9]{32})\.vizhub\.pro$;
proxy_pass http://127.0.0.1:8000;
```

Django в `get_profile_from_request` распознаёт 32-символьный поддомен.

## API

- `POST /api/plugin/activate-by-token/` — активация по токену из письма
- `GET /api/plugin/platforms/` — список площадок (с `X-License-Hash`)
- `POST /api/plugin/resend-activation-email/` — новое письмо с **новым** хешем

## Плагин (DLL)

1. Пользователь вставляет URL из письма **или** plain-токен.
2. `activate-by-token` → `license_hash`, `platforms`, `offline_models_path`.
3. Выбор площадки → все запросы на `platforms[i].api_base_url`.
4. Дальше — `X-License-Hash: license_hash`.
