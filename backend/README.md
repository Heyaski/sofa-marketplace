# Sofa Marketplace (Backend)

##Стек технологий
- Python 3.13
- Django 5.2
- Django REST Framework (DRF)
- SimpleJWT (авторизация через токены)
- Django Filters (поиск и фильтрация)
- PostgreSQL / SQLite
- Gmail SMTP (отправка писем для восстановления пароля)
- Django Jazzmin

--

## Установка и запуск

```bash
# Клонирование репозитория
cd sofa-marketplace/backend

# Создание виртуального окружения
python -m venv venv
.\venv\Scripts\activate   # (Windows)
source venv/bin/activate # (Linux/Mac)

# Установка зависимостей
pip install -r requirements.txt

# Применение миграций
python manage.py makemigrations
python manage.py migrate

# Создание суперпользователя
python manage.py createsuperuser

# Запуск сервера
python manage.py runserver
