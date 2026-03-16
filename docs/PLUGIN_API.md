# API для плагина (Revit / загрузка моделей)

Плагин подключается к сайту через REST API. Авторизация — заголовок `X-License-Hash` (ключ лицензии из профиля пользователя на сайте).

**Base URL:** `https://your-domain.com/api/` (или `http://localhost:8000/api/` для разработки)

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

## Логика плагина

1. **Активация:** пользователь вставляет ключ (хеш) из профиля на сайте → `POST /api/plugin/activate/` с `X-License-Hash`. Если `valid: true` — лицензия активна.
2. **Список:** `GET /api/plugin/products/` — показать товары с `has_glb` / `has_rfa`.
3. **Скачивание:** пользователь выбирает товар и формат → `POST /api/plugin/download/` с `product_id` и `format`. Получить `url` и скачать файл по этому URL (GET, без доп. заголовков — URL уже подписан при необходимости).

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

## Ключ лицензии

- Ключ выдаётся **только при оплате подписки** (basic, pro, premium). Trial — без ключа.
- Ключ хранится в БД в виде SHA256-хеша.
- В профиле на сайте пользователь видит свой ключ (хеш) и копирует его в плагин.
- Плагин отправляет этот хеш в заголовке `X-License-Hash` без дополнительного хеширования.
