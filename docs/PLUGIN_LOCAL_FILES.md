# Плагин: автоматическая активация и локальные файлы

## Для заказчика (кратко)

1. **Ссылка для активации** — приходит **на email** после оплаты. На сайте вручную копировать URL хранилища не нужно.
2. **Автоматика** — плагин вызывает `POST /api/plugin/activate/` с ключом лицензии и получает все настройки в JSON (вшито в ответ сервера).
3. **Локальные файлы** — пользователь указывает папку на ПК, например `D:\project\sofa-marketplace`. Плагин ищет `Тумба0084.glb` там **до** скачивания из облака.

## Ответ activate (новые поля)

```json
{
  "valid": true,
  "api_base_url": "https://<license_hash>.vizhub.pro/api",
  "activation_url": "https://<license_hash>.vizhub.pro/api",
  "license_hash": "...",
  "offline_models_path": "D:\\project\\sofa-marketplace",
  "file_resolution": "local_first",
  "storage_backend": "local_first"
}
```

## Ответ download

```json
{
  "url": "https://s3.../assets/Тумба0084.glb",
  "suggested_filename": "Тумба0084.glb",
  "local_file_candidate": "D:\\project\\sofa-marketplace\\Тумба0084.glb",
  "offline_models_path": "D:\\project\\sofa-marketplace",
  "file_resolution": "local_first"
}
```

## Логика в плагине (3ds Max / Revit)

```
1. activate → сохранить api_base_url, offline_models_path, file_resolution
2. download(product) → получить local_file_candidate и url
3. if file_resolution != "vizhub_cloud" and File.Exists(local_file_candidate):
       import local file
   elif file_resolution != "local_only" and url:
       download url
   else:
       error "file not found"
```

Также искать по артикулу: `{offline_path}\{article}.glb`, `{offline_path}\**\{article}.glb`.

## Email

- Отправка при `activate_subscription()` (оплата ЮKassa).
- Повтор: `POST /api/plugin/resend-activation-email/` (JWT).

## Профиль на сайте

Профиль → Подписка → блок «Плагин»: локальная папка и режим (локально / облако / оба).

## Что нужно в DLL плагина

Обновить сборку плагина под поля `api_base_url`, `local_file_candidate`, `file_resolution` — без этого локальный режим на стороне сервера уже готов, но клиент 3ds Max должен их использовать.
