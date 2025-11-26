# 🔧 Техническая документация: Система импорта товаров

## Архитектура решения

### 1. Модели данных

#### FileAsset (новая модель)

```python
class FileAsset(models.Model):
    asset_id = models.CharField(max_length=50, unique=True)  # Уникальный ID
    file_type = models.CharField(choices=['image', '3d_model'])
    file = models.FileField(upload_to="assets/")
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Назначение:** Централизованное хранилище файлов с возможностью ссылки по ID.

#### Product (обновленная модель)

```python
class Product(models.Model):
    # ... существующие поля ...

    # Новые поля
    image_asset_ids = models.CharField(max_length=500, blank=True)
    model_3d_asset_ids = models.CharField(max_length=500, blank=True)

    # Методы для получения связанных файлов
    def get_image_assets(self)
    def get_3d_model_assets(self)
```

**Изменения:**

- Добавлены поля для хранения ID файлов через запятую
- Методы для получения связанных объектов FileAsset
- Полная обратная совместимость с существующими товарами

### 2. Логика импорта

#### Файл: `backend/apps/catalog/admin.py`

```python
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    def import_excel(self, request):
        # Обработка POST запроса с Excel файлом
        # Парсинг xlsx с помощью openpyxl
        # Создание/обновление товаров
        # Отчет о результатах
```

**Ключевые особенности:**

1. **Обработка Excel:**

   - Использует `openpyxl` для чтения .xlsx
   - Пропускает первую строку (заголовки)
   - Игнорирует пустые строки

2. **Создание/обновление:**

   - `Product.objects.update_or_create()` - по полю `title`
   - Если товар существует → обновление
   - Если нет → создание

3. **Обработка ошибок:**
   - Try-catch для каждой строки
   - Сбор всех ошибок
   - Отчет в Django messages

### 3. API сериализация

#### Файл: `backend/apps/catalog/serializers.py`

```python
class ProductSerializer(serializers.ModelSerializer):
    asset_images = serializers.SerializerMethodField()
    asset_3d_models = serializers.SerializerMethodField()

    def get_image(self, obj):
        # Приоритет 1: FileAsset изображения
        # Приоритет 2: ProductImage
        # Приоритет 3: Product.image (legacy)
```

**Приоритизация источников изображений:**

```
1. FileAsset (image_asset_ids) ← Новая система
2. ProductImage               ← Существующая система
3. Product.image              ← Legacy поле
```

## Структура базы данных

### Таблицы

```sql
-- Новая таблица
CREATE TABLE catalog_fileasset (
    id INTEGER PRIMARY KEY,
    asset_id VARCHAR(50) UNIQUE,
    file_type VARCHAR(20),
    file VARCHAR(100),
    description VARCHAR(255),
    created_at DATETIME
);

-- Обновленная таблица
ALTER TABLE catalog_product ADD COLUMN image_asset_ids VARCHAR(500);
ALTER TABLE catalog_product ADD COLUMN model_3d_asset_ids VARCHAR(500);
```

### Связи

```
Product.image_asset_ids = "img_001,img_002"
                          ↓
FileAsset.objects.filter(asset_id__in=['img_001', 'img_002'])
                          ↓
                    FileAsset записи
```

**Тип связи:** "Мягкая" связь через текстовые ID (не Foreign Key)

**Преимущества:**

- ✅ Гибкость (можно указывать несуществующие ID)
- ✅ Простота в Excel (просто текст через запятую)
- ✅ Нет каскадного удаления

**Недостатки:**

- ⚠️ Нет автоматической валидации
- ⚠️ Возможны "мертвые" ссылки

## API эндпоинты

### Получение товара

```http
GET /api/catalog/products/{id}/
```

**Ответ:**

```json
{
  "id": 1,
  "title": "Диван",
  "price": "50000.00",
  "material": "Ткань",
  "category": { ... },

  // Основное изображение (автоматический выбор)
  "image": "http://site.com/media/assets/img_001.jpg",

  // Все изображения из старой системы
  "images": [ ... ],

  // Изображения из FileAsset (новая система)
  "asset_images": [
    {
      "asset_id": "img_001",
      "file_type": "image",
      "file_url": "http://site.com/media/assets/img_001.jpg",
      "description": ""
    }
  ],

  // 3D модели из FileAsset
  "asset_3d_models": [
    {
      "asset_id": "model_001",
      "file_type": "3d_model",
      "file_url": "http://site.com/media/assets/model.glb",
      "description": ""
    }
  ]
}
```

### Список товаров

```http
GET /api/catalog/products/
```

Все поля включены автоматически в serializer.

## Файловая структура

```
backend/
├── apps/
│   └── catalog/
│       ├── models.py              ← FileAsset модель
│       ├── admin.py               ← Импорт логика
│       ├── serializers.py         ← API сериализация
│       ├── templates/
│       │   └── admin/
│       │       └── catalog/
│       │           ├── import_excel.html          ← Форма импорта
│       │           ├── product_changelist.html    ← Кнопка импорта
│       │           └── fileasset_changelist.html  ← Подсказки
│       └── migrations/
│           └── 0006_fileasset_product_image_asset_ids_and_more.py
│
├── media/
│   └── assets/                    ← Хранилище FileAsset файлов
│
├── create_example_excel.py        ← Генератор примера
├── example_products_import.xlsx   ← Пример Excel
└── requirements.txt               ← openpyxl добавлен
```

## Миграции

### 0006_fileasset_product_image_asset_ids_and_more.py

```python
operations = [
    migrations.CreateModel(
        name='FileAsset',
        fields=[
            ('id', ...),
            ('asset_id', models.CharField(max_length=50, unique=True)),
            ('file_type', models.CharField(max_length=20)),
            ('file', models.FileField(upload_to='assets/')),
            ('description', models.CharField(max_length=255, blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ],
    ),
    migrations.AddField(
        model_name='product',
        name='image_asset_ids',
        field=models.CharField(max_length=500, blank=True),
    ),
    migrations.AddField(
        model_name='product',
        name='model_3d_asset_ids',
        field=models.CharField(max_length=500, blank=True),
    ),
]
```

## Зависимости

### Новая зависимость: openpyxl

```txt
openpyxl==3.1.5
```

**Использование:**

- Чтение Excel файлов (.xlsx)
- Парсинг ячеек и строк
- Поддержка формул и стилей (не используется)

## Производительность

### Импорт

**Сложность:** O(n) где n - количество строк в Excel

**Оптимизация:**

- `update_or_create()` - одна транзакция на товар
- Пакетная обработка ошибок
- Нет N+1 запросов

**Рекомендации:**

- До 1000 товаров: отлично
- 1000-5000 товаров: хорошо
- 5000+ товаров: рассмотрите асинхронный импорт (Celery)

### API запросы

**Дополнительные запросы:**

- `get_image_assets()`: 1 запрос к FileAsset
- `get_3d_model_assets()`: 1 запрос к FileAsset

**Оптимизация (будущее):**

- Использовать `prefetch_related()` в ViewSet
- Кэширование FileAsset запросов

## Безопасность

### Валидация файлов

⚠️ **Текущее состояние:** Минимальная валидация

**Рекомендации для production:**

1. **Ограничение типов файлов:**

```python
# В FileAsset модели
def clean(self):
    if self.file_type == 'image':
        allowed = ['.jpg', '.jpeg', '.png', '.webp']
    elif self.file_type == '3d_model':
        allowed = ['.glb', '.gltf', '.obj', '.fbx']
```

2. **Ограничение размера:**

```python
# В settings.py
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
```

3. **Проверка Excel:**

```python
# В admin.py import_excel
if not excel_file.name.endswith('.xlsx'):
    messages.error(request, "Только .xlsx файлы")
```

### Права доступа

**Кто может импортировать:**

- Только `is_staff=True` (админы)
- Django admin проверяет `has_module_perms()`

**Добавление пермишенов (опционально):**

```python
class Meta:
    permissions = [
        ("can_import_products", "Can import products from Excel"),
    ]
```

## Тестирование

### Ручное тестирование

1. **Создание FileAsset:**

```bash
python manage.py shell
>>> from apps.catalog.models import FileAsset
>>> from django.core.files import File
>>> with open('test.jpg', 'rb') as f:
...     asset = FileAsset.objects.create(
...         asset_id='test_001',
...         file_type='image',
...         file=File(f, name='test.jpg')
...     )
```

2. **Импорт Excel:**

- Создать тестовый .xlsx
- Загрузить через админку
- Проверить результаты

3. **API тест:**

```bash
curl http://localhost:8000/api/catalog/products/1/
```

### Автоматическое тестирование (рекомендация)

```python
# tests/test_import.py
from django.test import TestCase
from openpyxl import Workbook
import tempfile

class ImportTest(TestCase):
    def test_excel_import(self):
        # Создать тестовый Excel
        # Вызвать import_excel
        # Проверить создание товаров
        pass
```

## Расширение функционала

### Добавление новых полей в импорт

**Шаг 1:** Добавить колонку в Excel

**Шаг 2:** Обновить `admin.py`:

```python
def import_excel(self, request):
    # ...
    new_field = row[9] if len(row) > 9 else ""

    product, created = Product.objects.update_or_create(
        title=title,
        defaults={
            # ... existing fields ...
            'new_field': new_field,
        }
    )
```

### Валидация ID перед импортом

```python
# В import_excel
def validate_asset_ids(ids_string):
    if not ids_string:
        return True
    ids = [id.strip() for id in ids_string.split(',')]
    existing = FileAsset.objects.filter(asset_id__in=ids).count()
    return existing == len(ids)

# Использование
if not validate_asset_ids(image_asset_ids):
    errors.append(f"Строка {row_num}: Не все ID изображений существуют")
    continue
```

### Асинхронный импорт (Celery)

```python
# tasks.py
@shared_task
def import_products_async(file_path):
    # Логика импорта
    pass

# admin.py
def import_excel(self, request):
    # Сохранить файл временно
    # Запустить задачу
    import_products_async.delay(temp_file_path)
    messages.info(request, "Импорт запущен в фоне")
```

## Мониторинг и логирование

### Рекомендации

```python
import logging

logger = logging.getLogger(__name__)

def import_excel(self, request):
    logger.info(f"User {request.user} started import")
    # ...
    logger.info(f"Import completed: {created_count} created, {updated_count} updated")
```

## Резервное копирование

**Перед массовым импортом:**

```bash
python manage.py dumpdata catalog.Product > products_backup.json
```

**Восстановление:**

```bash
python manage.py loaddata products_backup.json
```

---

**Версия:** 1.0  
**Дата:** Ноябрь 2025  
**Автор:** Система импорта для SofaMarketplace

