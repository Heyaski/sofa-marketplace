# 🔧 Исправление ошибки ERR_NAME_NOT_RESOLVED для S3 Beget

## 🚨 Проблема

При попытке загрузить изображения из S3 хранилища Beget возникает ошибка:

```
GET https://s3.beget.com/604ac302c572-joyful-valeriy/products/id_9d9070721.jpg 
net::ERR_NAME_NOT_RESOLVED
```

## 🔍 Причина

Ошибка `ERR_NAME_NOT_RESOLVED` означает, что DNS не может разрешить домен `s3.beget.com`. Это может происходить по нескольким причинам:

1. **Неправильный endpoint URL** - возможно, ваш бакет использует другой endpoint (например, `s3.ru1.storage.beget.cloud`)
2. **Custom domain не настроен** - система использует path-style URL вместо virtual hosted style
3. **Неправильный формат URL** - должен использоваться virtual hosted style: `bucket-name.s3.beget.com`

## ✅ Решение

### Шаг 1: Проверьте правильный endpoint URL в панели Beget

1. Войдите в панель управления Beget
2. Откройте ваше S3 хранилище
3. Перейдите в раздел **"Реквизиты доступа"**
4. Проверьте поле **"URL"** - это ваш endpoint URL

**Важно:** Endpoint URL может быть одним из следующих:
- `https://s3.beget.com` (стандартный)
- `https://s3.ru1.storage.beget.cloud` (для региона ru1)
- Другой endpoint в зависимости от региона

### Шаг 2: Проверьте публичный URL бакета

В том же разделе **"Реквизиты доступа"** найдите поле **"Публичный URL бакета"**.

Он должен быть в формате: `your-bucket-name.s3.beget.com` (virtual hosted style)

**Пример:**
- Имя бакета: `604ac302c572-joyful-valeriy`
- Публичный URL: `604ac302c572-joyful-valeriy.s3.beget.com`

### Шаг 3: Обновите настройки в `.env`

Откройте файл `.env` в папке `backend/` и проверьте/обновите следующие параметры:

```bash
# Активация S3 хранилища
USE_S3_STORAGE=1

# Реквизиты доступа
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_STORAGE_BUCKET_NAME=604ac302c572-joyful-valeriy

# Endpoint URL (из раздела "Реквизиты доступа" -> "URL")
# ВАЖНО: Используйте точный URL из панели Beget!
AWS_S3_ENDPOINT_URL=https://s3.beget.com
# ИЛИ, если указано в панели:
# AWS_S3_ENDPOINT_URL=https://s3.ru1.storage.beget.cloud

# Публичный URL бакета (из раздела "Реквизиты доступа" -> "Публичный URL бакета")
# ВАЖНО: Указывайте ТОЛЬКО домен БЕЗ протокола (без https://)
AWS_S3_CUSTOM_DOMAIN=604ac302c572-joyful-valeriy.s3.beget.com

# Режим доступа (для публичного доступа используйте 'public')
S3_FILE_ACCESS_MODE=public
```

### Шаг 4: Автоматическое формирование custom domain

**Хорошая новость:** Система теперь автоматически формирует custom domain из имени бакета, если он не указан.

Если вы не укажете `AWS_S3_CUSTOM_DOMAIN`, система автоматически создаст его в формате:
```
{bucket-name}.{endpoint-domain}
```

Например:
- Bucket: `604ac302c572-joyful-valeriy`
- Endpoint: `s3.beget.com`
- Автоматический custom domain: `604ac302c572-joyful-valeriy.s3.beget.com`

### Шаг 5: Перезапустите Django сервер

После изменения настроек обязательно перезапустите сервер:

```bash
cd backend
python manage.py runserver
```

Проверьте вывод в консоли - должно появиться сообщение:

```
✅ S3 хранилище активировано: 604ac302c572-joyful-valeriy
   Публичный URL: https://604ac302c572-joyful-valeriy.s3.beget.com/
```

### Шаг 6: Проверьте формат URL

После перезапуска URL файлов должны быть в формате:

**Правильный формат (virtual hosted style):**
```
https://604ac302c572-joyful-valeriy.s3.beget.com/products/id_9d9070721.jpg
```

**Неправильный формат (path style, который вызывает ошибку):**
```
https://s3.beget.com/604ac302c572-joyful-valeriy/products/id_9d9070721.jpg
```

## 🔍 Дополнительная диагностика

### Проверка DNS разрешения

Проверьте, может ли ваш компьютер/сервер разрешить домен:

**Windows (PowerShell):**
```powershell
nslookup s3.beget.com
nslookup 604ac302c572-joyful-valeriy.s3.beget.com
```

**Linux/Mac:**
```bash
nslookup s3.beget.com
nslookup 604ac302c572-joyful-valeriy.s3.beget.com
```

Если `s3.beget.com` не разрешается, но `604ac302c572-joyful-valeriy.s3.beget.com` разрешается - это нормально! Используйте virtual hosted style.

### Проверка доступности endpoint

Попробуйте открыть в браузере:
- `https://s3.beget.com` - может не работать (это нормально)
- `https://604ac302c572-joyful-valeriy.s3.beget.com` - должен работать

### Альтернативный endpoint для региона ru1

Если ваш бакет находится в регионе ru1, используйте:

```bash
AWS_S3_ENDPOINT_URL=https://s3.ru1.storage.beget.cloud
AWS_S3_CUSTOM_DOMAIN=604ac302c572-joyful-valeriy.s3.ru1.storage.beget.cloud
```

## 🚨 Если проблема сохраняется

### Вариант 1: Проверьте настройки в панели Beget

1. Убедитесь, что бакет существует и активен
2. Проверьте, что включена публичная политика доступа
3. Убедитесь, что публичный URL бакета указан правильно

### Вариант 2: Используйте другой endpoint

Если `s3.beget.com` не работает, попробуйте:

1. Проверьте в панели Beget, какой endpoint указан в "Реквизитах доступа"
2. Используйте точный endpoint из панели
3. Если указан региональный endpoint (например, `s3.ru1.storage.beget.cloud`), используйте его

### Вариант 3: Временное решение - используйте локальное хранилище

Если проблема критична и нужно быстро восстановить работу:

```bash
# В .env файле
USE_S3_STORAGE=0
```

Затем перезапустите сервер. Файлы будут храниться локально.

## 📝 Резюме

**Основные причины ошибки:**
1. ❌ Использование path-style URL (`s3.beget.com/bucket/...`) вместо virtual hosted style
2. ❌ Неправильный endpoint URL
3. ❌ Custom domain не настроен

**Решение:**
1. ✅ Используйте virtual hosted style: `bucket-name.s3.beget.com`
2. ✅ Укажите правильный endpoint URL из панели Beget
3. ✅ Укажите custom domain или позвольте системе создать его автоматически
4. ✅ Убедитесь, что `S3_FILE_ACCESS_MODE=public` для публичного доступа

---

**После применения исправлений URL файлов должны работать корректно!** ✅

