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
    "apps.pages",
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
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
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
# Если используется S3 хранилище, эти настройки будут переопределены ниже
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ============================================
# Настройки S3 хранилища (Beget)
# ============================================
# Для использования S3 хранилища установите переменные окружения:
# USE_S3_STORAGE=1
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key
# AWS_STORAGE_BUCKET_NAME=your_bucket_name
# AWS_S3_ENDPOINT_URL=https://s3.beget.com (или ваш endpoint URL из панели Beget)
# AWS_S3_CUSTOM_DOMAIN=your-bucket.s3.beget.com (публичный URL бакета из панели Beget)

USE_S3_STORAGE = bool(int(get_env("USE_S3_STORAGE", "0")))

if USE_S3_STORAGE:
    # Настройки для S3 хранилища Beget
    AWS_ACCESS_KEY_ID = get_env("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = get_env("AWS_SECRET_ACCESS_KEY", "")
    AWS_STORAGE_BUCKET_NAME = get_env("AWS_STORAGE_BUCKET_NAME", "")
    
    # Проверка наличия обязательных параметров
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY or not AWS_STORAGE_BUCKET_NAME:
        print("⚠️ ВНИМАНИЕ: S3 хранилище активировано, но не указаны обязательные параметры!")
        print("   Установите в .env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME")
        print("   Или установите USE_S3_STORAGE=0 для использования локального хранилища")
    else:
        # Endpoint URL для Beget S3 (из панели управления Beget -> Реквизиты доступа -> URL)
        AWS_S3_ENDPOINT_URL = get_env("AWS_S3_ENDPOINT_URL", "https://s3.beget.com")
        
        # Регион для подписи URL (определяется автоматически из endpoint URL, но можно указать явно)
        # Если endpoint содержит ru1, используется ru1, иначе можно указать в AWS_S3_REGION_NAME
        AWS_S3_REGION_NAME_FOR_SIGNING = get_env("AWS_S3_REGION_NAME_FOR_SIGNING", None)
        
        # Режим доступа к файлам (проверяем ДО установки custom domain)
        # 'public-read' - публичный доступ (любой может скачать по прямой ссылке)
        # 'private' - приватный доступ (только через подписанные URL)
        S3_FILE_ACCESS_MODE = get_env("S3_FILE_ACCESS_MODE", "public")  # 'public' или 'signed'
        
        # Публичный URL бакета (из панели управления Beget -> Реквизиты доступа -> Публичный URL бакета)
        # ВАЖНО: Указывайте только домен БЕЗ протокола (например: bucket.s3.beget.com)
        # НЕ указывайте https:// в начале!
        # Для подписанных URL custom domain будет автоматически отключен
        custom_domain_raw = get_env("AWS_S3_CUSTOM_DOMAIN", "").replace('https://', '').replace('http://', '').strip('/')
        
        if S3_FILE_ACCESS_MODE == 'signed':
            # Для подписанных URL ОБЯЗАТЕЛЬНО использовать endpoint URL вместо custom domain
            # Custom domain не поддерживает подпись правильно в django-storages
            AWS_S3_CUSTOM_DOMAIN = None
            if custom_domain_raw:
                print(f"⚠️ ВНИМАНИЕ: При использовании подписанных URL custom domain будет отключен")
                print(f"   Используется endpoint URL для правильной генерации подписанных URL")
        else:
            # Для публичного доступа используем custom domain если указан
            AWS_S3_CUSTOM_DOMAIN = custom_domain_raw if custom_domain_raw else None
        
        # Настройки для работы с файлами
        AWS_S3_OBJECT_PARAMETERS = {
            'CacheControl': 'max-age=86400',  # Кэширование на 1 день
        }
        
        # Используем S3 для медиа-файлов (3D модели, изображения)
        DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
        
        # Для подписанных URL используем path-style addressing вместо virtual-hosted-style
        # чтобы избежать проблем с дублированием пути в URL
        if S3_FILE_ACCESS_MODE == 'signed':
            # Используем path-style URL формат: https://endpoint/bucket/path/to/file
            # вместо virtual-hosted-style: https://bucket.endpoint/path/to/file
            AWS_S3_ADDRESSING_STYLE = 'path'
        
        # Для S3 хранилища MEDIA_URL не используется напрямую,
        # так как S3Boto3Storage сам генерирует полные URL через AWS_S3_CUSTOM_DOMAIN
        # Но оставляем для совместимости с другими частями кода
        if AWS_S3_CUSTOM_DOMAIN:
            # Используем кастомный домен (публичный URL бакета)
            MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
        else:
            # Используем endpoint URL с именем бакета
            MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
        
        # Настройки для регионов (для Beget не требуется)
        # Важно: Beget S3 не использует регионы, поэтому оставляем None
        AWS_S3_REGION_NAME = None
        
        # Подпись URL (для приватных файлов, если нужно)
        AWS_S3_SIGNATURE_VERSION = 's3v4'
        
        # Разрешить автоматическое определение Content-Type
        AWS_S3_FILE_OVERWRITE = False  # Не перезаписывать файлы с одинаковыми именами
        
        if S3_FILE_ACCESS_MODE == 'signed':
            # Приватный доступ - файлы доступны только через подписанные URL
            AWS_DEFAULT_ACL = 'private'
            AWS_QUERYSTRING_AUTH = True  # Требовать подпись для URL
            AWS_QUERYSTRING_EXPIRE = 3600  # Срок действия подписанного URL (1 час)
        else:
            # Публичный доступ - файлы доступны по прямой ссылке
            AWS_DEFAULT_ACL = 'public-read'
            AWS_QUERYSTRING_AUTH = False  # Не требовать подпись для URL
        
        # Для работы с большими файлами (3D модели)
        AWS_S3_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB
        AWS_S3_MULTIPART_THRESHOLD = 100 * 1024 * 1024  # 100 MB
        AWS_S3_MULTIPART_CHUNKSIZE = 10 * 1024 * 1024  # 10 MB
        
        print(f"✅ S3 хранилище активировано: {AWS_STORAGE_BUCKET_NAME}")
        if AWS_S3_CUSTOM_DOMAIN:
            print(f"   Публичный URL: https://{AWS_S3_CUSTOM_DOMAIN}/")
        else:
            print(f"   Endpoint URL: {AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/")
else:
    print("ℹ️ Используется локальное хранилище (MEDIA_ROOT)")

# Настройки для загрузки больших файлов (3D модели могут быть очень большими)
# Максимальный размер файла в памяти перед записью на диск (по умолчанию 2.5MB)
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB

# Максимальный размер данных запроса (исключая файлы)
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB

# Максимальное количество файлов в одном запросе
DATA_UPLOAD_MAX_NUMBER_FILES = 1000

# Максимальный размер одного файла (настраивается на уровне веб-сервера)
# Для Nginx: client_max_body_size 500M;
# Для Apache: LimitRequestBody 524288000

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
        "catalog.FileAsset": "fas fa-file",
        "baskets.Basket": "fas fa-shopping-cart",
        "baskets.BasketItem": "fas fa-shopping-basket",
        "subscriptions.Plan": "fas fa-crown",
        "subscriptions.Subscription": "fas fa-id-card",
        "downloads.Download": "fas fa-download",
        "orders.Order": "fas fa-receipt",
        "orders.OrderItem": "fas fa-list",
        "users.UserProfile": "fas fa-user-circle",
        "chats.Chat": "fas fa-comments",
        "chats.Message": "fas fa-envelope",
        "chats.MessageProduct": "fas fa-box",
        "chats.MessageBasket": "fas fa-shopping-bag",
    },
    
    # Русские названия приложений
    "custom_links": {
        "auth": [{
            "name": "Пользователи",
            "url": "admin:auth_user_changelist",
            "icon": "fas fa-users",
        }],
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
