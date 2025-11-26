# 🔧 Исправление неактивной кнопки "Открыть 3D Viewer"

Если кнопка "Открыть 3D Viewer" неактивна (серая), это означает, что у товара нет связанных 3D моделей.

## ✅ Шаг 1: Проверьте консоль браузера

1. Откройте страницу товара
2. Нажмите F12 (откройте DevTools)
3. Перейдите на вкладку **Console**
4. Найдите сообщения, начинающиеся с `=== Product Data ===`

Вы должны увидеть:
```
=== Product Data ===
Product ID: 1
Product Title: Название товара
asset_3d_models: undefined или []
```

**Если `asset_3d_models: undefined` или `[]`** - значит данные не приходят с API или товар не связан с 3D моделью.

## ✅ Шаг 2: Проверьте API напрямую

1. Откройте в браузере: `http://localhost:8000/api/catalog/products/ID_ТОВАРА/`
2. Найдите поле `asset_3d_models`
3. Проверьте, что там есть данные:

```json
{
  "id": 1,
  "title": "Название товара",
  "asset_3d_models": [
    {
      "asset_id": "model_001",
      "file_type": "3d_model",
      "file_url": "http://localhost:8000/media/assets/model_001.glb"
    }
  ]
}
```

**Если поле `asset_3d_models` отсутствует или пустое** - проблема на стороне бэкенда или товар не связан с 3D моделью.

## ✅ Шаг 3: Проверьте связь товара с 3D моделью в админке

1. Откройте админку Django: `http://localhost:8000/admin/`
2. Перейдите: **Catalog → Products**
3. Найдите ваш товар и откройте его для редактирования
4. Прокрутите до раздела **"Файловые ресурсы (ID из таблицы FileAsset)"**
5. Проверьте поле **"ID 3D моделей"**

**Должно быть указано:**
- `model_001` (одна модель)
- или `model_001,model_002` (несколько моделей через запятую)

**Если поле пустое:**
- Укажите ID вашей 3D модели
- Нажмите "Сохранить"

## ✅ Шаг 4: Проверьте, что FileAsset существует

1. В админке перейдите: **Catalog → Файловые ресурсы** (File assets)
2. Найдите FileAsset с ID, который вы указали в товаре
3. Проверьте:
   - **ID файла** - должен совпадать с тем, что указано в товаре
   - **Тип файла** - должен быть **"3D Модель"**
   - **Файл** - должен быть загружен

**Если FileAsset не существует:**
- Создайте новый FileAsset (см. инструкцию `HOW_TO_ADD_3D_MODEL.md`)
- Убедитесь, что ID совпадает с тем, что указано в товаре

## ✅ Шаг 5: Проверьте метод get_3d_model_assets

Убедитесь, что в модели Product метод `get_3d_model_assets()` работает правильно:

1. Откройте Django shell:
   ```bash
   cd backend
   python manage.py shell
   ```

2. Выполните:
   ```python
   from apps.catalog.models import Product, FileAsset
   
   # Найдите ваш товар
   product = Product.objects.get(id=ID_ТОВАРА)
   
   # Проверьте поле model_3d_asset_ids
   print("model_3d_asset_ids:", product.model_3d_asset_ids)
   
   # Проверьте метод get_3d_model_assets
   models = product.get_3d_model_assets()
   print("3D models count:", models.count())
   for model in models:
       print(f"  - {model.asset_id}: {model.file_type}")
   ```

**Если метод возвращает пустой QuerySet:**
- Проверьте, что ID в поле `model_3d_asset_ids` правильные
- Проверьте, что FileAsset с такими ID существуют
- Проверьте, что у FileAsset тип файла = `'3d_model'`

## ✅ Шаг 6: Проверьте сериализатор

Убедитесь, что сериализатор правильно возвращает данные:

1. Откройте `backend/apps/catalog/serializers.py`
2. Найдите метод `get_asset_3d_models`:

```python
def get_asset_3d_models(self, obj):
    """Получить все 3D модели из FileAsset"""
    request = self.context.get("request")
    model_assets = obj.get_3d_model_assets()
    return FileAssetSerializer(model_assets, many=True, context={'request': request}).data
```

**Проверьте:**
- Метод вызывается правильно
- `request` передается в контекст (см. `views.py`)

## 🐛 Частые проблемы

### Проблема: Поле `asset_3d_models` не приходит с API

**Причины:**
1. Товар не связан с 3D моделью (поле `model_3d_asset_ids` пустое)
2. FileAsset с указанным ID не существует
3. У FileAsset неправильный тип файла (не `'3d_model'`)

**Решение:**
- Проверьте связь товара с FileAsset в админке
- Убедитесь, что FileAsset существует и имеет правильный тип

### Проблема: API возвращает пустой массив `[]`

**Причины:**
1. ID в поле `model_3d_asset_ids` указаны неправильно
2. FileAsset с такими ID не существуют
3. У FileAsset неправильный тип файла

**Решение:**
- Проверьте ID в админке
- Убедитесь, что FileAsset существуют с такими ID
- Проверьте тип файла у FileAsset

### Проблема: Кнопка активна, но модальное окно пустое

**Это другая проблема** - см. `DEBUG_3D_VIEWER.md`

## 📝 Быстрая проверка

Выполните эти шаги по порядку:

1. ✅ В админке: **Catalog → Файловые ресурсы** - есть ли FileAsset с типом "3D Модель"?
2. ✅ В админке: **Catalog → Products** - указан ли ID 3D модели в поле "ID 3D моделей"?
3. ✅ В браузере: `http://localhost:8000/api/catalog/products/ID/` - есть ли поле `asset_3d_models` с данными?
4. ✅ В консоли браузера: `asset_3d_models` не пустое?

Если все шаги пройдены, но кнопка все еще неактивна - проверьте консоль браузера на ошибки JavaScript.

---

**После исправления:**
- Обновите страницу товара (Ctrl+F5)
- Проверьте консоль браузера
- Кнопка должна стать активной

