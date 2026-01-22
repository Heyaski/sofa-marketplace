# 🔧 Исправление ошибки "NoSuchBucket" и неправильных path-style URL

## 🚨 Проблема

При использовании региональных endpoints Beget (например, `s3.ru1.storage.beget.cloud`) возникают ошибки:

1. **Ошибка "NoSuchBucket"**: URL формируется без имени бакета
   ```
   https://s3.ru1.storage.beget.cloud/assets/file.glb
   ```
   Вместо правильного:
   ```
   https://s3.ru1.storage.beget.cloud/604ac302c572-joyful-valeriy/assets/file.glb
   ```

2. **Ошибка CORS**: Запросы блокируются из-за отсутствия CORS заголовков

## ✅ Решение

### Шаг 1: Используется кастомный storage backend

Система автоматически использует кастомный `BegetS3Storage`, который правильно формирует path-style URL с именем бакета.

### Шаг 2: Настройка CORS в панели Beget

Для региональных endpoints нужно настроить CORS:

1. Войдите в панель управления Beget
2. Откройте ваше S3 хранилище
3. Перейдите в раздел **"Настройки CORS"**
4. Нажмите **"Добавить"** или **"Редактировать"**
5. Заполните настройки:
   - **Origin**: `https://vizhub.pro` (ваш домен)
   - **Разрешенные HTTP-методы**: `GET, HEAD, OPTIONS`
   - **Разрешенные заголовки**: `*` (или конкретные: `Authorization, Content-Type, x-amz-*`)
   - **Время кэширования CORS**: `3600`

### Шаг 3: Проверка настроек в `.env`

Убедитесь, что в `.env` правильно указаны настройки:

```bash
USE_S3_STORAGE=1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_STORAGE_BUCKET_NAME=604ac302c572-joyful-valeriy
AWS_S3_ENDPOINT_URL=https://s3.ru1.storage.beget.cloud
# Для региональных endpoints НЕ указывайте AWS_S3_CUSTOM_DOMAIN
# Система автоматически использует path-style addressing
S3_FILE_ACCESS_MODE=public
```

### Шаг 4: Перезапустите Django сервер

После изменений перезапустите сервер:

```bash
python manage.py runserver
```

Проверьте вывод в консоли - должно появиться:

```
✅ S3 хранилище активировано: 604ac302c572-joyful-valeriy
ℹ️ Обнаружен региональный endpoint: s3.ru1.storage.beget.cloud
   Для региональных endpoints используется path-style addressing
Endpoint URL: https://s3.ru1.storage.beget.cloud/604ac302c572-joyful-valeriy/
```

## 🔍 Проверка URL

После перезапуска URL файлов должны быть в правильном формате:

**Правильный формат (path-style с именем бакета):**
```
https://s3.ru1.storage.beget.cloud/604ac302c572-joyful-valeriy/assets/диван00010_li1btvj.glb
```

**Неправильный формат (без имени бакета):**
```
https://s3.ru1.storage.beget.cloud/assets/диван00010_li1btvj.glb
```

## 🚨 Если проблема сохраняется

### Вариант 1: Проверьте CORS настройки

1. Убедитесь, что CORS настроен в панели Beget
2. Проверьте, что ваш домен (`https://vizhub.pro`) добавлен в список разрешенных Origin
3. Убедитесь, что разрешены методы: `GET, HEAD, OPTIONS`

### Вариант 2: Проверьте публичную политику доступа

1. В панели Beget откройте настройки бакета
2. Перейдите в **"Политики доступа"**
3. Убедитесь, что включена **"Публичная политика"**

### Вариант 3: Используйте custom domain (если доступен)

Если в панели Beget указан публичный URL бакета, который работает:

1. Проверьте в разделе **"Реквизиты доступа"** → **"Публичный URL бакета"**
2. Укажите его в `.env`:
   ```bash
   AWS_S3_CUSTOM_DOMAIN=your-bucket-name.s3.beget.com
   ```
3. Перезапустите сервер

## 📝 Технические детали

### Кастомный storage backend

Система использует кастомный `BegetS3Storage` класс, который:

1. Определяет, используется ли custom domain
2. Если custom domain не установлен, формирует path-style URL с именем бакета
3. Правильно кодирует специальные символы в URL (кириллица, пробелы и т.д.)

### Формат URL

- **Path-style (для региональных endpoints):**
  ```
  https://endpoint/bucket-name/path/to/file
  ```

- **Virtual hosted style (для стандартных endpoints с custom domain):**
  ```
  https://bucket-name.endpoint/path/to/file
  ```

## ✅ Резюме

**Основные причины ошибки:**
1. ❌ URL формируется без имени бакета
2. ❌ CORS не настроен для региональных endpoints
3. ❌ Неправильная кодировка специальных символов в URL

**Решение:**
1. ✅ Используется кастомный storage backend для правильного формирования URL
2. ✅ Настроен CORS в панели Beget
3. ✅ Правильно кодируются специальные символы в URL
4. ✅ Используется path-style addressing для региональных endpoints

---

**После применения исправлений URL файлов должны работать корректно!** ✅

