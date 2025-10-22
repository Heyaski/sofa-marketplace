# Архитектура проекта Sofa Marketplace

## Обзор проекта

Sofa Marketplace - это веб-приложение для продажи 3D моделей мебели, состоящее из Django REST API бэкенда и Next.js фронтенда.

## Структура проекта

```
sofa-marketplace/
├── backend/                 # Django REST API
│   ├── apps/               # Django приложения
│   │   ├── catalog/        # Каталог продуктов
│   │   ├── baskets/        # Корзины покупок
│   │   ├── orders/         # Заказы
│   │   ├── subscriptions/ # Подписки
│   │   ├── downloads/     # Загрузки
│   │   └── users/         # Пользователи
│   ├── config/             # Настройки Django
│   ├── services/           # Бизнес-логика
│   └── manage.py
├── frontend/               # Next.js приложение
│   ├── src/
│   │   ├── app/           # App Router страницы
│   │   ├── components/    # React компоненты
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API сервисы
│   │   ├── types/         # TypeScript типы
│   │   ├── lib/           # Утилиты
│   │   └── config/       # Конфигурация
│   └── public/            # Статические файлы
├── database/              # SQL скрипты
├── docs/                  # Документация
└── infra/                 # Инфраструктура
```

## Бэкенд (Django REST API)

### Технологии:

- **Django 4.x** - веб-фреймворк
- **Django REST Framework** - API фреймворк
- **PostgreSQL** - база данных
- **JWT** - аутентификация
- **CORS** - кросс-доменные запросы

### Приложения:

#### 1. Catalog (Каталог)

- **Модели:** Product, Category
- **API:** CRUD операции для продуктов и категорий
- **Фильтрация:** по категории, цене, стилю, цвету
- **Поиск:** по названию и описанию

#### 2. Baskets (Корзины)

- **Модели:** Basket, BasketItem
- **API:** управление корзинами и товарами
- **Функции:** добавление, удаление, изменение количества

#### 3. Orders (Заказы)

- **Модели:** Order
- **API:** создание и управление заказами
- **Интеграция:** с платежными системами

#### 4. Subscriptions (Подписки)

- **Модели:** Plan, Subscription
- **API:** управление планами подписок
- **Функции:** активация/деактивация подписок

#### 5. Downloads (Загрузки)

- **Модели:** Download
- **API:** управление загрузками файлов
- **Функции:** отслеживание скачиваний

#### 6. Users (Пользователи)

- **Модели:** расширение User модели
- **API:** управление профилями пользователей
- **Аутентификация:** JWT токены

### API Endpoints:

```
# Продукты
GET    /products/              # Список продуктов
POST   /products/               # Создание продукта
GET    /products/{id}/         # Получение продукта
PUT    /products/{id}/         # Обновление продукта
DELETE /products/{id}/         # Удаление продукта

# Категории
GET    /categories/            # Список категорий
POST   /categories/            # Создание категории
GET    /categories/{id}/       # Получение категории
PUT    /categories/{id}/       # Обновление категории
DELETE /categories/{id}/       # Удаление категории

# Корзины
GET    /baskets/                # Список корзин пользователя
POST   /baskets/                # Создание корзины
GET    /baskets/{id}/           # Получение корзины
PUT    /baskets/{id}/           # Обновление корзины
DELETE /baskets/{id}/           # Удаление корзины

# Элементы корзины
GET    /basket-items/           # Список элементов
POST   /basket-items/           # Добавление в корзину
GET    /basket-items/{id}/      # Получение элемента
PUT    /basket-items/{id}/      # Обновление элемента
DELETE /basket-items/{id}/      # Удаление элемента
```

## Фронтенд (Next.js)

### Технологии:

- **Next.js 14** - React фреймворк
- **TypeScript** - типизация
- **Tailwind CSS** - стилизация
- **Axios** - HTTP клиент
- **React Hook Form** - формы
- **Zustand** - управление состоянием

### Структура:

#### 1. Pages (Страницы)

- **/** - главная страница
- **/catalog** - каталог продуктов
- **/product/[id]** - страница продукта
- **/profile** - профиль пользователя

#### 2. Components (Компоненты)

- **Header** - шапка сайта
- **Footer** - подвал сайта
- **ProductCard** - карточка продукта
- **ProductGrid** - сетка продуктов
- **CartModal** - модальное окно корзины
- **HeroSection** - главная секция

#### 3. Services (Сервисы)

- **api.ts** - API клиент и сервисы
- **useApi.ts** - custom hooks для API

#### 4. Types (Типы)

- **index.ts** - TypeScript интерфейсы

### Состояние приложения:

- **Локальное состояние** - React hooks (useState, useEffect)
- **API состояние** - custom hooks (useProducts, useCategories)
- **Глобальное состояние** - Zustand (при необходимости)

## База данных

### Схема:

```sql
-- Категории
CREATE TABLE catalog_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES catalog_category(id)
);

-- Продукты
CREATE TABLE catalog_product (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES catalog_category(id),
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    material VARCHAR(120),
    style VARCHAR(120),
    color VARCHAR(60),
    is_active BOOLEAN DEFAULT TRUE
);

-- Корзины
CREATE TABLE baskets_basket (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id),
    name VARCHAR(255) DEFAULT 'Новая корзина',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Элементы корзины
CREATE TABLE baskets_basketitem (
    id SERIAL PRIMARY KEY,
    basket_id INTEGER REFERENCES baskets_basket(id),
    product_id INTEGER REFERENCES catalog_product(id),
    quantity INTEGER DEFAULT 1,
    format VARCHAR(10)
);
```

## API Документация

### Аутентификация:

```http
POST /auth/login/
Content-Type: application/json

{
    "username": "user",
    "password": "password"
}

Response:
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### Получение продуктов:

```http
GET /products/?category=1&price_min=1000&search=диван
Authorization: Bearer <access_token>

Response:
{
    "count": 25,
    "next": "http://localhost:8000/products/?page=2",
    "previous": null,
    "results": [
        {
            "id": 1,
            "title": "Современный диван",
            "category": {
                "id": 1,
                "name": "Прямые диваны",
                "slug": "straight-sofas"
            },
            "description": "Описание продукта",
            "price": "45000.00",
            "material": "Ткань",
            "style": "Современный",
            "color": "Серый",
            "is_active": true
        }
    ]
}
```

## Безопасность

### Бэкенд:

- **JWT токены** для аутентификации
- **CORS** настройки для фронтенда
- **Права доступа** на уровне API
- **Валидация данных** через сериализаторы

### Фронтенд:

- **Типизация** TypeScript
- **Валидация форм** через React Hook Form
- **Безопасные HTTP запросы** через Axios
- **Обработка ошибок** в компонентах

## Развертывание

### Разработка:

- **Бэкенд:** `python manage.py runserver` (порт 8000)
- **Фронтенд:** `npm run dev` (порт 3000)
- **База данных:** PostgreSQL локально

### Продакшен:

- **Бэкенд:** Gunicorn + Nginx
- **Фронтенд:** Next.js статическая сборка
- **База данных:** PostgreSQL на сервере
- **Файлы:** AWS S3 или локальное хранилище

## Мониторинг и логирование

### Бэкенд:

- Django логирование
- Ошибки в файлы
- Метрики производительности

### Фронтенд:

- Console логирование
- Обработка ошибок
- Аналитика пользователей

## Планы развития

### Краткосрочные:

- [ ] Аутентификация пользователей
- [ ] Система заказов
- [ ] Платежная интеграция
- [ ] Админ панель

### Долгосрочные:

- [ ] Мобильное приложение
- [ ] Система рекомендаций
- [ ] Интеграция с 3D просмотрщиком
- [ ] Многоязычность
