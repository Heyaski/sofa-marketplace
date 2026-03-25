from pathlib import Path
import os
from datetime import timedelta
from corsheaders.defaults import default_headers

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

# URL фронтенда (для ссылок в КП и email-ах)
FRONTEND_URL = get_env("FRONTEND_URL", "https://vizhub.pro")

INSTALLED_APPS = [
    "jazzmin",  # Должен быть перед django.contrib.admin
    "adminsortable2",  # drag-and-drop сортировка в админке
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
    "apps.plugin",
    "apps.orders",
    "apps.users",
    "apps.chats",
    "apps.pages",
    "django_filters",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "config.middleware.MediaCacheMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Для обслуживания статики в продакшене
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True  # разрешает все origins
# Явный whitelist для проды (на случай если ALLOW_ALL отключат)
CORS_ALLOWED_ORIGINS = [
    "https://www.vizhub.pro",
    "https://vizhub.pro",
    "https://www.vizhub.org",
    "https://vizhub.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Разрешаем кастомный заголовок лицензии для API плагина
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-license-hash",
]

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

# Redis для кэширования API (список товаров, детали — ускоряет загрузку 3D моделей)
REDIS_URL = get_env("REDIS_URL", "redis://127.0.0.1:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
            "IGNORE_EXCEPTIONS": True,
            "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
        },
        "KEY_PREFIX": "vizhub",
        "TIMEOUT": 3600,
    },
}

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "UTC"
USE_I18N = USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "config.authentication.OptionalJWTAuthentication",
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

# Настройки Telegram бота (для отправки КП)
TELEGRAM_BOT_TOKEN = get_env("TELEGRAM_BOT_TOKEN", "")

# Настройки ЮКассы
YOOKASSA_ACCOUNT_ID = get_env("YOOKASSA_ACCOUNT_ID", "")
YOOKASSA_SECRET_KEY = get_env("YOOKASSA_SECRET_KEY", "")
YOOKASSA_TEST_MODE = bool(int(get_env("YOOKASSA_TEST_MODE", "1")))  # По умолчанию тестовый режим

# Медиа-файлы (загрузка изображений, фото и т.п.)
# Если используется S3 хранилище, эти настройки будут переопределены ниже
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Настройка хранилища файлов (Django 5.2+)
# По умолчанию используем локальное хранилище
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

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
            # Если не указан, проверяем тип endpoint
            endpoint_domain = AWS_S3_ENDPOINT_URL.replace('https://', '').replace('http://', '').strip('/')
            is_regional_endpoint = '.ru' in endpoint_domain or '.storage.beget.cloud' in endpoint_domain
            
            if custom_domain_raw:
                # Пользователь явно указал custom domain - используем его
                AWS_S3_CUSTOM_DOMAIN = custom_domain_raw
            elif is_regional_endpoint:
                # Для региональных endpoints НЕ формируем custom domain автоматически
                # Используем path-style addressing с endpoint URL
                AWS_S3_CUSTOM_DOMAIN = None
                print(f"ℹ️ Обнаружен региональный endpoint: {endpoint_domain}")
                print(f"   Для региональных endpoints используется path-style addressing")
                print(f"   Если нужен custom domain, укажите его явно в AWS_S3_CUSTOM_DOMAIN")
                print(f"   (из панели Beget -> Реквизиты доступа -> Публичный URL бакета)")
            else:
                # Для стандартных endpoints автоматически формируем custom domain
                AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.{endpoint_domain}"
                print(f"ℹ️ Custom domain не указан, используется автоматически сформированный: {AWS_S3_CUSTOM_DOMAIN}")
        
        # Настройки для работы с файлами
        # 3D модели и изображения редко меняются — кэш 1 год, при обновлении страницы браузер не перекачивает
        AWS_S3_OBJECT_PARAMETERS = {
            'CacheControl': 'public, max-age=31536000, immutable',
        }
        
        # Используем S3 для медиа-файлов (3D модели, изображения)
        # В Django 5.2+ используется STORAGES вместо DEFAULT_FILE_STORAGE
        # GLBOptimizingS3Storage — оптимизирует GLB при сохранении (60→~27 MB)
        STORAGES["default"] = {
            "BACKEND": "storage.GLBOptimizingS3Storage",
        }
        
        # Настройка стиля адресации URL
        if S3_FILE_ACCESS_MODE == 'signed':
            # Для подписанных URL используем path-style addressing
            # Path-style формат: https://endpoint/bucket/path/to/file
            # Это необходимо для правильной генерации подписанных URL
            AWS_S3_ADDRESSING_STYLE = 'path'
        else:
            # Для публичного доступа
            if AWS_S3_CUSTOM_DOMAIN:
                # Если custom domain установлен, используем virtual-hosted-style
                # Virtual-hosted-style формат: https://bucket.endpoint/path/to/file
                AWS_S3_ADDRESSING_STYLE = 'virtual'
            else:
                # Если custom domain не установлен (например, для региональных endpoints),
                # используем path-style
                # Path-style формат: https://endpoint/bucket/path/to/file
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

# gltfpack: целевой размер 20 MB (баланс качества и скорости)
GLB_TARGET_MB = float(get_env("GLB_TARGET_MB", "20"))

# Настройки для загрузки больших файлов (3D модели могут быть очень большими)
# ВАЖНО: FILE_UPLOAD_MAX_MEMORY_SIZE должен быть НЕБОЛЬШИМ, чтобы файлы сразу писались на диск
# Если установить большое значение (например, 200GB), Django попытается загрузить файл в память,
# что приведет к падению сервера из-за нехватки памяти
# Файлы больше этого размера будут автоматически сохраняться на диск (streaming)
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100 MB - файлы больше будут писаться на диск

# Максимальный размер данных запроса (включая файлы и ZIP архивы)
# Это общий лимит размера всего запроса, включая все поля формы
# Увеличиваем для загрузки файлов до 200GB
# 200GB = 200 * 1024 * 1024 * 1024 = 214748364800 байт
DATA_UPLOAD_MAX_MEMORY_SIZE = 200 * 1024 * 1024 * 1024  # 200 GB

# Максимальное количество файлов в одном запросе
DATA_UPLOAD_MAX_NUMBER_FILES = 10000  # Увеличиваем для массовой загрузки

# Максимальный размер одного файла (настраивается на уровне веб-сервера)
# Для Nginx: client_max_body_size 200G; (установлено в infra/nginx/nginx.conf)
# Для Apache: LimitRequestBody 214748364800
# 
# ВАЖНО: После изменения этих настроек:
# 1. Перезапустите Django сервер: sudo systemctl restart sofa-backend
# 2. Обновите конфигурацию Nginx и перезапустите: sudo nginx -t && sudo systemctl reload nginx
# 3. Проверьте systemd лимиты для nginx и gunicorn (см. NGINX_200GB_UPLOAD.md)
# 4. Для файлов > 200GB они будут автоматически сохраняться на диск, а не в память
# 5. Проверьте, что файлы действительно загружаются в S3, а не на локальный диск

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
    "site_title": "VIZHUB.PRO Admin",
    "site_header": "VIZHUB.PRO",
    "site_brand": "VIZHUB.PRO",
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
    "copyright": "VIZHUB.PRO",
    
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
