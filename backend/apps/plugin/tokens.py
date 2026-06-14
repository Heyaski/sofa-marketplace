"""Выдача и проверка одноразовых токенов активации плагина."""
from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from apps.plugin.connection import plugin_keyed_api_base_domain
from apps.plugin.models import PluginActivationToken, PluginPlatform


def default_platforms_for_profile(profile):
    """Площадки, доступные пользователю (пока все активные; позже — по подписке)."""
    qs = PluginPlatform.objects.filter(is_active=True).order_by("sort_order", "name")
    if not qs.exists():
        domain = plugin_keyed_api_base_domain()
        return [
            {
                "slug": "default",
                "name": "VizHub",
                "api_base_url": f"https://api.{domain}/api"
                if not domain.startswith("api.")
                else f"https://{domain}/api",
                "database_alias": "default",
                "is_default": True,
            }
        ]
    return [
        {
            "slug": p.slug,
            "name": p.name,
            "api_base_url": p.api_base_url.rstrip("/"),
            "database_alias": p.database_alias or "default",
            "is_default": p.is_default,
        }
        for p in qs
    ]


def build_activation_urls(subdomain_key: str) -> dict:
    domain = plugin_keyed_api_base_domain()
    keyed = f"https://{subdomain_key}.{domain}/api"
    frontend = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    web = f"{frontend}/plugin/activate?k={subdomain_key}" if frontend else keyed
    return {
        "activation_url": keyed,
        "activation_url_keyed": keyed,
        "activation_web_page": web,
    }


def issue_activation_token(profile, *, platform=None) -> tuple[str, PluginActivationToken, dict]:
    """Новый plain-токен + строки для email (subdomain каждый раз другой)."""
    plain, row = PluginActivationToken.create_for_profile(profile, platform=platform)
    urls = build_activation_urls(row.subdomain_key)
    urls["plain_activation_token"] = plain
    urls["expires_at"] = row.expires_at.isoformat()
    urls["subdomain_key"] = row.subdomain_key
    return plain, row, urls


def resolve_profile_by_plain_token(plain_token: str):
    if not plain_token or len(plain_token.strip()) < 16:
        return None, None
    token_hash = PluginActivationToken.hash_plain_token(plain_token)
    row = (
        PluginActivationToken.objects.select_related("profile", "profile__user", "platform")
        .filter(token_hash=token_hash, revoked=False)
        .first()
    )
    if not row or not row.is_valid():
        return None, row
    return row.profile, row


def resolve_profile_by_subdomain_key(subdomain_key: str):
    if not subdomain_key or len(subdomain_key) != 32:
        return None, None
    key = subdomain_key.strip().lower()
    if not all(c in "0123456789abcdef" for c in key):
        return None, None
    row = (
        PluginActivationToken.objects.select_related("profile", "profile__user", "platform")
        .filter(subdomain_key=key, revoked=False)
        .first()
    )
    if not row or not row.is_valid():
        return None, row
    return row.profile, row


def activation_payload(profile, token_row: PluginActivationToken | None, *, mark_used: bool = False) -> dict:
    from apps.plugin.connection import build_plugin_connection_payload

    base = build_plugin_connection_payload(profile)
    platforms = default_platforms_for_profile(profile)
    if token_row and token_row.platform_id:
        p = token_row.platform
        platforms = [
            {
                "slug": p.slug,
                "name": p.name,
                "api_base_url": p.api_base_url.rstrip("/"),
                "database_alias": p.database_alias or "default",
                "is_default": p.is_default,
            }
        ]
    if token_row:
        urls = build_activation_urls(token_row.subdomain_key)
        base.update(urls)
        base["token_expires_at"] = token_row.expires_at.isoformat()
        base["activation_mode"] = "one_time_hashed_subdomain"
        if mark_used:
            token_row.mark_used()
    base["platforms"] = platforms
    return base
