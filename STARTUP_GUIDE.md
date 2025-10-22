# Инструкция по запуску проекта Sofa Marketplace

## Предварительные требования

### 1. Установка Python

- Скачайте и установите Python 3.8+ с [python.org](https://www.python.org/downloads/)
- Убедитесь, что Python добавлен в PATH
- Проверьте установку: `python --version`

### 2. Установка Node.js

- Скачайте и установите Node.js 18+ с [nodejs.org](https://nodejs.org/)
- Проверьте установку: `node --version` и `npm --version`

### 3. Установка PostgreSQL

- Скачайте и установите PostgreSQL с [postgresql.org](https://www.postgresql.org/download/)
- Создайте базу данных `sofa_marketplace` и пользователя `sofa_user` с паролем `12345`

## Настройка бэкенда (Django)

### 1. Перейдите в папку backend

```bash
cd backend
```

### 2. Создайте виртуальное окружение

```bash
python -m venv venv
```

### 3. Активируйте виртуальное окружение

**Windows:**

```bash
venv\Scripts\activate
```

**macOS/Linux:**

```bash
source venv/bin/activate
```

### 4. Установите зависимости

```bash
pip install -r requirements.txt
```

### 5. Создайте файл .env (опционально)

```bash
# Создайте файл .env в папке backend со следующим содержимым:
DEBUG=1
DJANGO_SECRET=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 6. Примените миграции

```bash
python manage.py makemigrations
python manage.py migrate
```

### 7. Создайте суперпользователя (опционально)

```bash
python manage.py createsuperuser
```

### 8. Запустите сервер разработки

```bash
python manage.py runserver
```

Бэкенд будет доступен по адресу: http://localhost:8000

## Настройка фронтенда (Next.js)

### 1. Откройте новый терминал и перейдите в папку frontend

```bash
cd frontend
```

### 2. Установите зависимости

```bash
npm install
```

### 3. Создайте файл .env.local (опционально)

```bash
# Создайте файл .env.local в папке frontend со следующим содержимым:
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Sofa Marketplace
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 4. Запустите сервер разработки

```bash
npm run dev
```

Фронтенд будет доступен по адресу: http://localhost:3000

## Структура API

### Основные endpoints:

- **Продукты:** `GET /api/products/` - список продуктов
- **Категории:** `GET /api/categories/` - список категорий
- **Корзины:** `GET /api/baskets/` - список корзин пользователя
- **Элементы корзины:** `POST /api/basket-items/` - добавление товара в корзину
- **Авторизация:** `POST /api/auth/login/` - вход в систему
- **Регистрация:** `POST /api/users/register/` - регистрация пользователя
- **Профиль:** `GET /api/users/me/` - информация о текущем пользователе

### Примеры запросов:

```bash
# Получить все продукты
curl http://localhost:8000/api/products/

# Получить продукты с фильтрацией
curl "http://localhost:8000/api/products/?category=1&price_min=1000&price_max=5000"

# Получить все категории
curl http://localhost:8000/api/categories/

# Получить все корзины
curl http://localhost:8000/api/baskets/

# Авторизация
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'

# Регистрация
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "email": "user@example.com", "password": "password123", "password_confirm": "password123", "first_name": "Иван", "last_name": "Иванов"}'

# Получить профиль (требует авторизации)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8000/api/users/me/
```

## Возможные проблемы и решения

### 1. Ошибка подключения к базе данных

- Убедитесь, что PostgreSQL запущен
- Проверьте настройки в `backend/config/settings.py`
- Создайте базу данных и пользователя

### 2. Ошибки CORS

- CORS уже настроен в `backend/config/settings.py`
- Убедитесь, что `CORS_ALLOW_ALL_ORIGINS = True`

### 3. Ошибки миграций

- Удалите папку `migrations` в каждом приложении (кроме `__init__.py`)
- Выполните: `python manage.py makemigrations`
- Затем: `python manage.py migrate`

### 4. Проблемы с зависимостями

- Убедитесь, что виртуальное окружение активировано
- Переустановите зависимости: `pip install -r requirements.txt`

## Разработка

### Добавление новых продуктов через админку:

1. Перейдите на http://localhost:8000/admin/
2. Войдите как суперпользователь
3. Добавьте категории в "Categories"
4. Добавьте продукты в "Products"

### Страницы авторизации:

- **Вход:** http://localhost:3000/login
- **Регистрация:** http://localhost:3000/register
- **Профиль:** http://localhost:3000/profile

### Тестирование API:

- Используйте Postman или curl для тестирования endpoints
- Проверьте документацию API по адресу: http://localhost:8000/api/

## Производственное развертывание

Для продакшена:

1. Измените `DEBUG = False` в настройках
2. Настройте `ALLOWED_HOSTS` для вашего домена
3. Используйте переменные окружения для секретных ключей
4. Настройте статические файлы и медиа
5. Используйте веб-сервер (nginx + gunicorn)

## Полезные команды

```bash
# Бэкенд
python manage.py runserver          # Запуск сервера
python manage.py makemigrations     # Создание миграций
python manage.py migrate            # Применение миграций
python manage.py collectstatic      # Сбор статических файлов
python manage.py shell              # Django shell

# Фронтенд
npm run dev                        # Запуск в режиме разработки
npm run build                      # Сборка для продакшена
npm run start                      # Запуск продакшен сборки
npm run lint                       # Проверка кода
```
