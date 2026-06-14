"""Настройки подключения плагина: URL API, офлайн-папка, email активации."""
from __future__ import annotations

import logging
import os

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

STORAGE_BACKEND_CHOICES = (
    ("vizhub_cloud", "Облако VizHub (S3)"),
    ("local_first", "Сначала локальная папка, затем облако"),
    ("local_only", "Только локальная папка"),
)


def plugin_keyed_api_base_domain() -> str:
    raw = (
        getattr(settings, "PLUGIN_KEYED_API_BASE_DOMAIN", None)
        or getattr(settings, "FRONTEND_URL", "https://vizhub.pro")
        or "vizhub.pro"
    )
    domain = str(raw).strip().lower()
    domain = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if domain.startswith("www."):
        domain = domain[4:]
    return domain or "vizhub.pro"


def build_plugin_api_base_url(license_hash: str) -> str:
    lh = (license_hash or "").strip().lower()
    if not lh:
        return ""
    return f"https://{lh}.{plugin_keyed_api_base_domain()}/api"


def build_local_file_candidate(offline_models_path: str, filename: str) -> str:
    """Путь к файлу на ПК пользователя (Windows/UNC). Плагин проверяет его первым."""
    base = (offline_models_path or "").strip()
    name = (filename or "").strip()
    if not base or not name:
        return ""
    return os.path.normpath(os.path.join(base, name))


def build_plugin_connection_payload(profile) -> dict:
    lh = (getattr(profile, "license_key_hash", None) or "").strip()
    offline_path = (getattr(profile, "plugin_offline_models_path", None) or "").strip()
    storage = (getattr(profile, "plugin_storage_backend", None) or "local_first").strip()
    return {
        "license_hash": lh,
        "api_base_url": build_plugin_api_base_url(lh),
        "activation_url": build_plugin_api_base_url(lh),
        "offline_models_path": offline_path,
        "file_resolution": storage if storage in ("local_first", "local_only", "vizhub_cloud") else "local_first",
        "storage_backend": storage,
        "supported_local_path_examples": [
            "D:\\Models\\VizHub",
            "\\\\NAS\\share\\models",
        ],
    }


def send_plugin_activation_email(profile, *, force: bool = False) -> bool:
    """
    Письмо с одноразовой хешированной ссылкой активации (каждый раз новая).
    Старые неиспользованные токены отзываются.
    """
    from apps.plugin.tokens import activation_payload, default_platforms_for_profile, issue_activation_token

    user = getattr(profile, "user", None)
    if not user or not (user.email or "").strip():
        return False
    if profile.subscription_type not in ("basic", "pro", "premium"):
        return False

    if not profile.license_key_hash:
        if not profile.ensure_license_key_hash():
            return False
        profile.save(update_fields=["license_key_hash"])

    plain, token_row, urls = issue_activation_token(profile)
    payload = activation_payload(profile, token_row, mark_used=False)
    offline_path = payload.get("offline_models_path") or "не задана (можно указать в личном кабинете)"
    platforms = default_platforms_for_profile(profile)
    platform_lines = "\n".join(
        f"  • {p['name']}: {p['api_base_url']}" for p in platforms
    )

    subject = "VizHub — активация плагина (новая ссылка)"
    body = f"""Здравствуйте, {user.first_name or user.username}!

Подписка активна. Ниже — одноразовая ссылка активации (каждое письмо генерирует новый хеш; старые ссылки перестают работать).

Ссылка для плагина (Server URL / API):
{urls['activation_url_keyed']}

Резервный токен (если плагин просит код, не URL):
{plain}

Срок действия ссылки: до {token_row.expires_at.strftime('%d.%m.%Y %H:%M')} UTC

Доступные площадки / базы каталога:
{platform_lines}

Локальная папка с моделями (опционально):
{offline_path}
Пример: D:\\project\\sofa-marketplace

После активации плагин сохранит ключ лицензии и дальше будет работать без повторной вставки ссылки.

Скачать установщик: {getattr(settings, 'FRONTEND_URL', 'https://vizhub.pro')}

VizHub
"""
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [user.email.strip()],
            fail_silently=False,
        )
        logger.info("Plugin activation email sent user_id=%s subdomain=%s", user.id, token_row.subdomain_key)
        return True
    except Exception:
        logger.exception("Failed to send plugin activation email user_id=%s", user.id)
        return False
