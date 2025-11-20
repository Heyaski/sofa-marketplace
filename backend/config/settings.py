from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# .env (простейший парсер)
def get_env(key, default=None):
    val = os.environ.get(key)
    if val is not None:
        return val
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.strip().startswith("#"):
                continue
            k, _, v = line.partition("=")
            if k.strip() == key:
                return v.strip()
    return default

SECRET_KEY = get_env("DJANGO_SECRET", "dev")
DEBUG = bool(int(get_env("DEBUG", "1")))
ALLOWED_HOSTS = get_env("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "jazzmin",  # Должен быть перед django.contrib.admin
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "corsheaders",

    "apps.catalog",
    "apps.baskets",
    "apps.subscriptions",
    "apps.downloads",
    "apps.orders",
    "apps.users",
    "apps.chats",
    "django_filters",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Для обслуживания статики в продакшене
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True  # на dev; на проде — список доменов

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}



LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "UTC"
USE_I18N = USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# Настройки для Gmail SMTP
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 465
EMAIL_USE_SSL = True
EMAIL_USE_TLS = False

EMAIL_HOST_USER = "antontenditnik60@gmail.com"
EMAIL_HOST_PASSWORD = "plryjeqormckvdta"
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# Медиа-файлы (загрузка изображений, фото и т.п.)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Статика
STATIC_ROOT = BASE_DIR / 'staticfiles'  # Директория для collectstatic

# STATICFILES_DIRS - только если директория существует
static_dir = BASE_DIR / 'static'
if static_dir.exists():
    STATICFILES_DIRS = [static_dir]

# WhiteNoise для статики в продакшене
# Используем CompressedStaticFilesStorage вместо CompressedManifestStaticFilesStorage
# для избежания проблем с манифестом
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Настройки Jazzmin для красивой админ-панели
JAZZMIN_SETTINGS = {
    # Заголовок сайта
    "site_title": "VIZHUB.ART Admin",
    "site_header": "VIZHUB.ART",
    "site_brand": "VIZHUB.ART",
    "site_logo": None,
    "login_logo": None,
    "login_logo_dark": None,
    "site_logo_classes": "img-circle",
    "site_icon": None,
    
    # Цветовая схема
    "theme": "flatly",  # Можно выбрать: default, cerulean, cosmo, cyborg, darkly, flatly, journal, litera, lumen, lux, materia, minty, pulse, sandstone, simplex, sketchy, slate, solar, spacelab, superhero, united, yeti
    
    # Настройки навигации
    "topmenu_links": [
        {"name": "Главная", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "API", "url": "/api/", "new_window": True},
    ],
    
    # Настройки пользователя
    "usermenu_links": [
        {"name": "Поддержка", "url": "https://github.com/farridav/django-jazzmin/issues", "icon": "fas fa-life-ring", "new_window": True},
    ],
    
    # Настройки бокового меню
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],
    
    # Иконки приложений
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.Group": "fas fa-users",
        "catalog.Category": "fas fa-folder",
        "catalog.Product": "fas fa-couch",
        "catalog.ProductImage": "fas fa-images",
        "baskets.Basket": "fas fa-shopping-cart",
        "baskets.BasketItem": "fas fa-shopping-basket",
        "subscriptions.Plan": "fas fa-crown",
        "subscriptions.Subscription": "fas fa-id-card",
        "downloads.Download": "fas fa-download",
        "orders.Order": "fas fa-receipt",
        "users.UserProfile": "fas fa-user-circle",
        "chats.Chat": "fas fa-comments",
        "chats.Message": "fas fa-envelope",
    },
    
    # Настройки интерфейса
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",
    
    # Настройки футера
    "copyright": "VIZHUB.ART",
    
    # Настройки поиска
    "search_model": ["auth.User", "catalog.Product"],
    
    # Настройки действий
    "actions_on_top": True,
    "actions_on_bottom": False,
    
    # Настройки фильтров
    "show_ui_builder": False,
    
    # Настройки языка
    "language_chooser": False,
    
    # Настройки изменений
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {
        "auth.user": "collapsible",
        "auth.group": "vertical_tabs",
    },
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour": "navbar-primary",
    "accent": "accent-primary",
    "navbar": "navbar-dark",
    "no_navbar_border": False,
    "navbar_fixed": True,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": True,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": False,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": False,
    "theme": "flatly",
    "dark_mode_theme": None,
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success"
    }
}
