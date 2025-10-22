# Настройки для разработки

## Переменные окружения для бэкенда (.env)

Создайте файл `.env` в папке `backend/`:

```env
# Django настройки
DEBUG=1
DJANGO_SECRET=your-secret-key-here-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# База данных (если используете PostgreSQL)
DB_NAME=sofa_marketplace
DB_USER=sofa_user
DB_PASSWORD=12345
DB_HOST=127.0.0.1
DB_PORT=5432

# Email настройки (для отправки уведомлений)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USE_SSL=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

## Переменные окружения для фронтенда (.env.local)

Создайте файл `.env.local` в папке `frontend/`:

```env
# API настройки
NEXT_PUBLIC_API_URL=http://localhost:8000

# Настройки приложения
NEXT_PUBLIC_APP_NAME=Sofa Marketplace
NEXT_PUBLIC_APP_VERSION=1.0.0

# Настройки для разработки
NEXT_PUBLIC_DEBUG=true
```

## Настройка базы данных PostgreSQL

### 1. Установка PostgreSQL

- Скачайте с [postgresql.org](https://www.postgresql.org/download/)
- Установите с настройками по умолчанию

### 2. Создание базы данных

```sql
-- Подключитесь к PostgreSQL как суперпользователь
psql -U postgres

-- Создайте базу данных
CREATE DATABASE sofa_marketplace;

-- Создайте пользователя
CREATE USER sofa_user WITH PASSWORD '12345';

-- Предоставьте права
GRANT ALL PRIVILEGES ON DATABASE sofa_marketplace TO sofa_user;

-- Выйдите
\q
```

### 3. Альтернативный способ (через командную строку)

```bash
# Создание базы данных
createdb -U postgres sofa_marketplace

# Создание пользователя
createuser -U postgres -P sofa_user
# Введите пароль: 12345
```

## Настройка виртуального окружения

### Windows:

```bash
# Создание
python -m venv venv

# Активация
venv\Scripts\activate

# Деактивация
deactivate
```

### macOS/Linux:

```bash
# Создание
python3 -m venv venv

# Активация
source venv/bin/activate

# Деактивация
deactivate
```

## Полезные команды для разработки

### Django команды:

```bash
# Создание миграций
python manage.py makemigrations

# Применение миграций
python manage.py migrate

# Создание суперпользователя
python manage.py createsuperuser

# Запуск сервера
python manage.py runserver

# Сбор статических файлов
python manage.py collectstatic

# Django shell
python manage.py shell

# Проверка настроек
python manage.py check
```

### Next.js команды:

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build

# Запуск продакшен сборки
npm run start

# Проверка кода
npm run lint

# Проверка типов TypeScript
npm run type-check
```

## Настройка IDE/редактора

### VS Code расширения:

- Python
- Django
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens

### Настройки VS Code (.vscode/settings.json):

```json
{
	"python.defaultInterpreterPath": "./backend/venv/Scripts/python.exe",
	"python.linting.enabled": true,
	"python.linting.pylintEnabled": true,
	"python.formatting.provider": "black",
	"typescript.preferences.importModuleSpecifier": "relative",
	"emmet.includeLanguages": {
		"javascript": "javascriptreact"
	},
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"source.fixAll.eslint": true
	}
}
```

## Отладка

### Django отладка:

```python
# В коде Django
import pdb; pdb.set_trace()

# Или используйте
breakpoint()
```

### Next.js отладка:

```javascript
// В коде React/Next.js
console.log('Debug info:', data)
debugger // Остановка в браузере
```

## Мониторинг и логирование

### Django логирование (settings.py):

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': 'debug.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
```

### Next.js логирование:

```javascript
// В компонентах
console.log('Component rendered:', props)

// В API routes
console.log('API called:', req.body)
```
