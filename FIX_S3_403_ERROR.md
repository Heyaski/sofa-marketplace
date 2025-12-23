# 🔧 Исправление ошибки 403 при доступе к файлам в S3

Если вы получаете ошибку **403 Forbidden** при попытке загрузить файл из S3 хранилища, выполните следующие шаги:

## ✅ Шаг 1: Включите публичную политику доступа в Beget

1. Войдите в панель управления Beget
2. Откройте ваше S3 хранилище
3. Перейдите в раздел **"Настройки"** → **"Политики доступа"**
4. Включите переключатель **"Публичная политика"** (должен быть включен)
5. Сохраните изменения

## ✅ Шаг 2: Проверьте ACL уже загруженных файлов

Если файлы были загружены **до** включения публичной политики, их ACL может быть неправильным.

### Вариант A: Исправление через панель Beget

1. Откройте ваше S3 хранилище в панели Beget
2. Перейдите в раздел **"Управление файлами"**
3. Найдите файл, который выдает ошибку 403
4. Нажмите на меню файла (три точки) → **"Настроить метаданные"**
5. Проверьте, что файл имеет публичный доступ

### Вариант B: Исправление через Python скрипт

Создайте файл `fix_s3_acl.py` в папке `backend/`:

```python
import os
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.files.storage import default_storage
from apps.catalog.models import FileAsset
import boto3
from django.conf import settings

# Подключение к S3
s3_client = boto3.client(
    's3',
    endpoint_url=settings.AWS_S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)

bucket_name = settings.AWS_STORAGE_BUCKET_NAME

# Исправление ACL для всех файлов FileAsset
print("Исправление ACL для файлов...")
for file_asset in FileAsset.objects.all():
    if file_asset.file:
        file_key = file_asset.file.name  # Путь к файлу в бакете
        try:
            # Устанавливаем публичный доступ
            s3_client.put_object_acl(
                Bucket=bucket_name,
                Key=file_key,
                ACL='public-read'
            )
            print(f"✅ Исправлен ACL для: {file_key}")
        except Exception as e:
            print(f"❌ Ошибка при исправлении {file_key}: {e}")

print("Готово!")
```

Запустите скрипт:

```bash
cd backend
python fix_s3_acl.py
```

## ✅ Шаг 3: Проверьте CORS настройки

1. В панели Beget откройте настройки бакета
2. Перейдите в раздел **"Настройки CORS"**
3. Убедитесь, что добавлена запись с вашим доменом:
   - **Origin**: `https://your-domain.com` (или `*` для всех доменов)
   - **Разрешенные HTTP-методы**: GET, HEAD, OPTIONS
   - **Разрешенные заголовки**: `*`
   - **Время кэширования CORS**: 3600

## ✅ Шаг 4: Перезагрузите файл через админ-панель

Если файл был загружен до исправления настроек:

1. Откройте админ-панель Django
2. Перейдите в **Catalog** → **Файловые ресурсы**
3. Найдите проблемный файл
4. Удалите его
5. Загрузите файл заново

Новые файлы будут автоматически получать правильный ACL (`public-read`).

## ✅ Шаг 5: Проверьте настройки в .env

Убедитесь, что в файле `.env` правильно указаны все параметры:

```bash
USE_S3_STORAGE=1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_STORAGE_BUCKET_NAME=your-bucket-name
AWS_S3_ENDPOINT_URL=https://s3.beget.com
AWS_S3_CUSTOM_DOMAIN=your-bucket.s3.beget.com  # БЕЗ https://
```

## 🔍 Проверка доступа к файлу

После выполнения всех шагов проверьте доступ к файлу:

1. Откройте URL файла в браузере:
   ```
   https://your-bucket.s3.beget.com/assets/your-file.glb
   ```

2. Если файл открывается или скачивается - проблема решена ✅

3. Если все еще ошибка 403:
   - Проверьте, что публичная политика действительно включена
   - Убедитесь, что файл существует в бакете
   - Проверьте правильность URL файла

## 📝 Дополнительная информация

- **ACL (Access Control List)** - список контроля доступа к файлу
- **public-read** - позволяет всем читать файл без авторизации
- **private** - файл доступен только владельцу

Для публичных файлов (3D модели, изображения) всегда используйте `public-read`.

