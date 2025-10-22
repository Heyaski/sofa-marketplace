# Примеры данных для тестирования

## Создание тестовых данных через Django shell

```python
# Запустите Django shell
python manage.py shell

# Импортируйте необходимые модели
from apps.catalog.models import Category, Product
from django.contrib.auth.models import User

# Создайте пользователя (если нужно)
user = User.objects.create_user('testuser', 'test@example.com', 'testpass123')

# Создайте категории
categories_data = [
    {'name': 'Прямые диваны', 'slug': 'straight-sofas'},
    {'name': 'Угловые диваны', 'slug': 'corner-sofas'},
    {'name': 'Кресла', 'slug': 'armchairs'},
    {'name': 'Столы обеденные', 'slug': 'dining-tables'},
    {'name': 'Стулья обеденные', 'slug': 'dining-chairs'},
    {'name': 'Шкафы книжные', 'slug': 'bookcases'},
    {'name': 'Тумбы прикроватные', 'slug': 'nightstands'},
    {'name': 'Столы письменные', 'slug': 'desks'},
    {'name': 'Кресла офисные', 'slug': 'office-chairs'},
    {'name': 'Пуфы', 'slug': 'ottomans'},
]

for cat_data in categories_data:
    Category.objects.get_or_create(
        slug=cat_data['slug'],
        defaults={'name': cat_data['name']}
    )

# Создайте продукты
products_data = [
    {
        'title': 'Современный диван "Минималист"',
        'category_slug': 'straight-sofas',
        'description': 'Современный диван в стиле минимализм с мягкими подушками',
        'price': 45000,
        'material': 'Ткань',
        'style': 'Современный',
        'color': 'Серый'
    },
    {
        'title': 'Угловой диван "Комфорт"',
        'category_slug': 'corner-sofas',
        'description': 'Просторный угловой диван для большой семьи',
        'price': 65000,
        'material': 'Кожа',
        'style': 'Классический',
        'color': 'Коричневый'
    },
    {
        'title': 'Кресло "Релакс"',
        'category_slug': 'armchairs',
        'description': 'Удобное кресло для отдыха и чтения',
        'price': 25000,
        'material': 'Ткань',
        'style': 'Современный',
        'color': 'Белый'
    },
    {
        'title': 'Обеденный стол "Дуб"',
        'category_slug': 'dining-tables',
        'description': 'Массивный стол из дуба для семейных обедов',
        'price': 35000,
        'material': 'Дерево',
        'style': 'Классический',
        'color': 'Коричневый'
    },
    {
        'title': 'Стул обеденный "Элегант"',
        'category_slug': 'dining-chairs',
        'description': 'Элегантный стул с мягким сиденьем',
        'price': 8500,
        'material': 'Дерево + Ткань',
        'style': 'Классический',
        'color': 'Белый'
    },
    {
        'title': 'Книжный шкаф "Модерн"',
        'category_slug': 'bookcases',
        'description': 'Современный книжный шкаф с открытыми полками',
        'price': 28000,
        'material': 'ДСП',
        'style': 'Современный',
        'color': 'Белый'
    },
    {
        'title': 'Тумба прикроватная "Стиль"',
        'category_slug': 'nightstands',
        'description': 'Компактная тумба с выдвижным ящиком',
        'price': 12000,
        'material': 'Дерево',
        'style': 'Современный',
        'color': 'Черный'
    },
    {
        'title': 'Письменный стол "Офис"',
        'category_slug': 'desks',
        'description': 'Функциональный стол для работы и учебы',
        'price': 22000,
        'material': 'ДСП',
        'style': 'Минимализм',
        'color': 'Белый'
    },
    {
        'title': 'Офисное кресло "Эргономик"',
        'category_slug': 'office-chairs',
        'description': 'Эргономичное кресло с регулируемой высотой',
        'price': 18000,
        'material': 'Ткань + Пластик',
        'style': 'Современный',
        'color': 'Серый'
    },
    {
        'title': 'Пуф "Уют"',
        'category_slug': 'ottomans',
        'description': 'Мягкий пуф для дополнительного сидения',
        'price': 8000,
        'material': 'Ткань',
        'style': 'Современный',
        'color': 'Бежевый'
    },
]

for prod_data in products_data:
    try:
        category = Category.objects.get(slug=prod_data['category_slug'])
        Product.objects.get_or_create(
            title=prod_data['title'],
            defaults={
                'category': category,
                'description': prod_data['description'],
                'price': prod_data['price'],
                'material': prod_data['material'],
                'style': prod_data['style'],
                'color': prod_data['color'],
                'is_active': True
            }
        )
        print(f"Создан продукт: {prod_data['title']}")
    except Category.DoesNotExist:
        print(f"Категория не найдена: {prod_data['category_slug']}")

print("Тестовые данные созданы!")
```

## Создание данных через админку Django

1. Запустите сервер: `python manage.py runserver`
2. Перейдите на http://localhost:8000/admin/
3. Войдите как суперпользователь
4. Добавьте категории в разделе "Categories"
5. Добавьте продукты в разделе "Products"

## Тестирование API

### Получение всех продуктов:

```bash
curl http://localhost:8000/api/products/
```

### Получение продуктов с фильтрацией:

```bash
# По категории
curl "http://localhost:8000/api/products/?category=1"

# По цене
curl "http://localhost:8000/api/products/?price_min=10000&price_max=50000"

# По стилю
curl "http://localhost:8000/api/products/?style=Современный"

# По цвету
curl "http://localhost:8000/api/products/?color=Белый"

# Комбинированные фильтры
curl "http://localhost:8000/api/products/?category=1&price_min=20000&style=Современный"
```

### Получение всех категорий:

```bash
curl http://localhost:8000/api/categories/
```

### Поиск по названию:

```bash
curl "http://localhost:8000/api/products/?search=диван"
```

### Сортировка:

```bash
# По цене (по возрастанию)
curl "http://localhost:8000/api/products/?ordering=price"

# По цене (по убыванию)
curl "http://localhost:8000/api/products/?ordering=-price"

# По названию
curl "http://localhost:8000/api/products/?ordering=title"
```
