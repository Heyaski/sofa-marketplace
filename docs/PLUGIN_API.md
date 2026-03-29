# API для плагина (Revit / загрузка моделей)

Плагин подключается к сайту через REST API. Авторизация — заголовок `X-License-Hash` (ключ лицензии из профиля пользователя на сайте).

**Base URL:** `https://api.vizhub.pro/api`

---

## 1. Активация лицензии

**POST** `/api/plugin/activate/`

**Заголовки:**
```
X-License-Hash: <хеш ключа из профиля пользователя>
User-Agent: SofaPlugin/1.0
Content-Type: application/json
```

**Ответ при успехе (200):**
```json
{
  "valid": true,
  "subscription_type": "basic",
  "subscription_type_display": "Базовый",
  "download_limit": null,
  "user_id": 42
}
```

**Ответ при неверном ключе (200):**
```json
{
  "valid": false,
  "error": "Неверный ключ лицензии"
}
```

**Ответ при истёкшей подписке (200):**
```json
{
  "valid": false,
  "error": "Подписка не активна или истекла"
}
```

---

## Legacy-совместимость (готовый плагин без изменений)

Для совместимости с уже собранным плагином поддерживается endpoint:

**POST** `/api/license.php`
и алиасы:
- `POST /api/license`
- `POST /license.php` (если в плагине base URL задан как корневой домен без `/api`)

**Тело запроса (как в плагине):**
```json
{
  "license_hash": "....",
  "hardware_id": "....",
  "plugin_version": "1.0.0",
  "feature": "download_fbx"
}
```

**Ответ:**
```json
{
  "valid": true,
  "message": "license is valid",
  "expires_at": "2026-04-01T12:00:00+00:00",
  "error_code": null,
  "features": ["download_fbx", "plugin_api"]
}
```

Таким образом готовый плагин можно подключить к текущему проекту без правок кода плагина.

---

## Офлайн-активация (окно «код запроса» → «код активации»)

Некоторые сборки плагина (например 3ds Max) показывают мастер: генерируется **код запроса**, во второе поле нужно вставить **код активации**. Подставлять напрямую хеш из профиля **нельзя** — это другой формат; код активации вычисляется из пары (код запроса + хеш лицензии) на сервере.

**POST** `/api/plugin/offline-activation/`

**Тело:**
```json
{
  "request_code": "<64 hex из поля «Код запроса»>",
  "license_hash": "<64 hex — хеш ключа из профиля на сайте>"
}
```

**Ответ при успехе:**
```json
{
  "valid": true,
  "activation_code": "<64 hex — вставить в «Код активации»>",
  "mode": "sha256_rl"
}
```

На сервере переменные окружения:

- `PLUGIN_OFFLINE_ACTIVATION_MODE` — алгоритм: `sha256_rl` (по умолчанию), `sha256_lr`, `sha256_pipe`, `sha256_colon`, `hmac_sha256_rl`, `hmac_sha256_lr`, или **`multi`**.
- `PLUGIN_OFFLINE_ACTIVATION_SECRET` — обязателен для режимов `hmac_*`, если в плагине используется HMAC с тем же секретом.

Режим **`multi`** возвращает все поддерживаемые варианты в поле `activation_codes` (словарь имя → hex). Пользователь по очереди вставляет значения в поле «Код активации» в плагине; когда сработает — в `.env` задают `PLUGIN_OFFLINE_ACTIVATION_MODE` равным **ключу** этого варианта (например `sha256_pipe`).

Если **ни один** вариант не принимается плагином, формула в DLL отличается от перечисленных — нужна спецификация у автора плагина или обновление плагина.

Пример запроса:
```bash
curl -s -X POST "https://api.vizhub.pro/api/plugin/offline-activation/" \
  -H "Content-Type: application/json" \
  -d "{\"request_code\":\"<64_hex>\",\"license_hash\":\"<64_hex>\"}"
```

---

## 2. Список товаров (с GLB/RFA)

**GET** `/api/plugin/products/`

**Заголовки:**
```
X-License-Hash: <хеш ключа>
User-Agent: SofaPlugin/1.0
```

**Ответ (200):**
```json
{
  "products": [
    {
      "id": 123,
      "title": "Диван П7682",
      "article": "П7682",
      "has_glb": true,
      "has_rfa": true
    }
  ]
}
```

---

## 3. Скачивание файла

**POST** `/api/plugin/download/`

**Заголовки:**
```
X-License-Hash: <хеш ключа>
User-Agent: SofaPlugin/1.0
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "product_id": 123,
  "format": "glb"
}
```

`format` — `"glb"` или `"rfa"`.

**Ответ при успехе (200):**
```json
{
  "url": "https://...",
  "download_id": 456,
  "remaining_downloads": 95,
  "suggested_filename": "П7682_Диван_П7682.glb"
}
```

**Ошибки:**
- `400` — `product_id` или `format` не указаны / неверный format
- `401` — отсутствует или неверный `X-License-Hash`
- `403` — подписка не активна или достигнут лимит скачиваний
- `404` — товар не найден или файл GLB/RFA отсутствует

---

1. **Активация:** пользователь вставляет ключ (хеш) из профиля → `POST /api/plugin/activate/` с `X-License-Hash`. Если `valid: true` — лицензия активна.
2. **Список:** `GET /api/plugin/products/` — показать товары с `has_glb` / `has_rfa`.
3. **Скачивание:** пользователь выбирает товар и формат → `POST /api/plugin/download/` с `product_id` и `format`. Получить `url` и скачать файл по этому URL (GET, без доп. заголовков — URL уже подписан при необходимости).

---

## UI на сайте (главная страница)

Для пользователей с активной платной подпиской (`basic`, `pro`, `premium`) на главной странице отображается плашка доступа к плагину:

1. Кнопка **«Активировать плагин»**.
2. После нажатия показывается ячейка с ключом `license_key_hash` из профиля пользователя.
3. Сайт отправляет `POST /api/plugin/activate/` с заголовком `X-License-Hash: <license_key_hash>`.
4. При `valid: true` пользователь получает подтверждение, что доступ к API плагина активен.

Ключ хранится в БД в хэшированном виде и в плагин передается как есть (без повторного хэширования).

---

## Пример для C# (WebClient / HttpClient)

```csharp
// 1. Активация
var activateUrl = $"{apiBaseUrl}/plugin/activate/";
using (var client = new WebClient())
{
    client.Headers.Add("User-Agent", "SofaPlugin/1.0");
    client.Headers.Add("X-License-Hash", licenseHash);
    client.Headers.Add("Content-Type", "application/json");
    string response = client.UploadString(activateUrl, "POST", "{}");
    var json = JsonConvert.DeserializeObject<JObject>(response);
    if (!(bool)json["valid"])
        throw new Exception((string)json["error"]);
}

// 2. Список товаров
var productsUrl = $"{apiBaseUrl}/plugin/products/";
string productsJson = client.DownloadString(productsUrl);
var products = JsonConvert.DeserializeObject<JObject>(productsJson)["products"];

// 3. Скачивание
var downloadUrl = $"{apiBaseUrl}/plugin/download/";
var body = JsonConvert.SerializeObject(new { product_id = 123, format = "glb" });
string downloadResponse = client.UploadString(downloadUrl, "POST", body);
var downloadData = JsonConvert.DeserializeObject<JObject>(downloadResponse);
string fileUrl = (string)downloadData["url"];
string suggestedName = (string)downloadData["suggested_filename"] ?? "model.glb";

// Скачать файл по URL (без заголовков — URL уже готов)
using (var fileClient = new WebClient())
{
    fileClient.DownloadFile(fileUrl, Path.Combine(savePath, suggestedName));
}
```

---

## 4. Прямое скачивание (совместимость с fbx_receiver)

**GET** `/api/assets/{fileName}.{ext}`

Для плагинов, которые делают прямой GET (без POST /download/). Заголовок `X-License-Hash` обязателен.

**Примеры:**
- `/api/assets/2602.glb` — по product_id
- `/api/assets/IMR-980756ORG.glb` — по артикулу
- `/api/assets/Пуф1586_QOVNVbx.glb` — по имени файла в storage

**Расширения:** `glb`, `rfa`, `rvt` (rvt → rfa).

**Ответ:** редирект 302 на URL файла. WebClient/HttpClient следует редиректу и скачивает файл.

**Настройка плагина:** `ApiBaseUrl = "https://api.vizhub.pro/api"`, тогда URL загрузки: `{ApiBaseUrl}/assets/{fileName}.glb`

---

## Ключ лицензии

- Ключ выдаётся **только при оплате подписки** (basic, pro, premium). Trial — без ключа.
- Ключ хранится в БД в виде SHA256-хеша.
- В профиле на сайте пользователь видит свой ключ (хеш) и копирует его в плагин.
- Плагин отправляет этот хеш в заголовке `X-License-Hash` без дополнительного хеширования.
