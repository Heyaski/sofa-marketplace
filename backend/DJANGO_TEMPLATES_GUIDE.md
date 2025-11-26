# ⚠️ Важно: Работа с Django шаблонами

## Проблема

Django template tags (`{% %}`) **НЕ МОГУТ** быть разбиты на несколько строк автоформатировщиками (Prettier, Black и т.д.). Это вызовет ошибку:

```
TemplateSyntaxError: Invalid block tag on line X: 'endblock'
```

## ❌ Неправильно (сломает шаблон)

```django
{% extends "admin/change_list.html" %} {% load static %} {% block
object-tools-items %} {{ block.super }}
<li>...</li>
{% endblock %}
```

## ✅ Правильно

```django
{% extends "admin/change_list.html" %}
{% load static %}

{% block object-tools-items %}
    {{ block.super }}
    <li>...</li>
{% endblock %}
```

## Решение

### 1. НЕ форматируйте Django шаблоны автоматически

В проекте уже настроены:
- **`.prettierignore`** - Prettier будет игнорировать `**/templates/**/*.html`
- **`.editorconfig`** - настройки для редактора

### 2. Если используете VS Code

Добавьте в `.vscode/settings.json`:

```json
{
  "files.associations": {
    "**/templates/**/*.html": "django-html"
  },
  "emmet.includeLanguages": {
    "django-html": "html"
  },
  "[django-html]": {
    "editor.formatOnSave": false
  }
}
```

### 3. Если используете другой редактор

- **PyCharm/WebStorm**: Django шаблоны поддерживаются по умолчанию
- **Sublime Text**: установите плагин "Djaneiro"
- **Atom**: установите пакет "language-django"

## Правила форматирования Django шаблонов

### 1. Template tags должны быть целыми

✅ **Правильно:**
```django
{% extends "base.html" %}
{% load static %}
{% block content %}
```

❌ **Неправильно:**
```django
{% extends "base.html" %} {% load static %} {% block content %}
```

### 2. Inline styles допустимы в админке Django

В Django Admin часто используются inline styles:

```django
<a href="{% url 'some_url' %}" style="background: #28a745; padding: 10px;">
    Кнопка
</a>
```

Это нормально и не нужно выносить в CSS.

### 3. Отступы

Используйте 4 пробела для отступов внутри template blocks:

```django
{% block content %}
    <div>
        <h1>Заголовок</h1>
        <p>Текст</p>
    </div>
{% endblock %}
```

## Команды для исправления

Если шаблоны уже сломаны, используйте эти файлы как образец:
- `backend/apps/catalog/templates/admin/catalog/product_changelist.html`
- `backend/apps/catalog/templates/admin/catalog/fileasset_changelist.html`
- `backend/apps/catalog/templates/admin/catalog/import_excel.html`

## Проверка шаблонов

Запустите Django сервер и проверьте страницу:

```bash
cd backend
python manage.py runserver
```

Откройте: `http://127.0.0.1:8000/admin/catalog/product/`

Если видите `TemplateSyntaxError` - шаблон сломан форматировщиком.

## Автоматическая защита

1. **Добавьте в pre-commit hook** (опционально):

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Проверка Django шаблонов перед коммитом
python manage.py check --deploy
```

2. **Используйте .gitattributes**:

```
**/templates/**/*.html linguist-language=Django
```

## Что делать, если сломался шаблон?

1. Откройте файл шаблона
2. Убедитесь, что каждый template tag находится на отдельной строке
3. Проверьте, что нет разрывов внутри `{% ... %}`
4. Сохраните и перезапустите сервер

## Дополнительные ресурсы

- [Django Template Language](https://docs.djangoproject.com/en/stable/ref/templates/language/)
- [Django Admin Templates](https://docs.djangoproject.com/en/stable/ref/contrib/admin/#admin-overriding-templates)

---

**Запомните:** Django шаблоны - это не обычный HTML. Они требуют особого обращения!


