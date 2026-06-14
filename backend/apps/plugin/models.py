"""Модели плагина: площадки (несколько баз) и одноразовые токены активации."""
from __future__ import annotations

import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


class PluginPlatform(models.Model):
    """
    Площадка / отдельная база каталога.
    Отдельный сервер: api_base_url → другой backend+PostgreSQL.
    Один сервер, несколько БД: задайте database_alias (см. DATABASES + router).
    """

    name = models.CharField(max_length=128, verbose_name="Название")
    slug = models.SlugField(max_length=64, unique=True, verbose_name="Код")
    api_base_url = models.URLField(
        verbose_name="URL API",
        help_text="Например https://api.vizhub.pro/api или https://partner.example.com/api",
    )
    database_alias = models.CharField(
        max_length=32,
        blank=True,
        default="",
        verbose_name="Alias БД Django",
        help_text="Пусто = default. Нужен DATABASE router для нескольких БД на одном сервере.",
    )
    is_default = models.BooleanField(default=False, verbose_name="По умолчанию")
    is_active = models.BooleanField(default=True, verbose_name="Активна")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Площадка плагина"
        verbose_name_plural = "Площадки плагина"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            PluginPlatform.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class PluginActivationToken(models.Model):
    """
    Одноразовая ссылка активации (каждое письмо — новый токен и новый subdomain-хеш).
    В БД хранится только SHA256(plain_token), plain уходит один раз в email.
    """

    profile = models.ForeignKey(
        "users.UserProfile",
        on_delete=models.CASCADE,
        related_name="plugin_activation_tokens",
    )
    platform = models.ForeignKey(
        PluginPlatform,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="activation_tokens",
        help_text="Пусто = доступ ко всем площадкам профиля",
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    subdomain_key = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        help_text="Первые 32 символа token_hash — поддомен https://{subdomain_key}.vizhub.pro",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Токен активации плагина"
        verbose_name_plural = "Токены активации плагина"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"token …{self.subdomain_key[-8:]} ({self.profile_id})"

    @classmethod
    def hash_plain_token(cls, plain_token: str) -> str:
        return hashlib.sha256(plain_token.strip().encode("utf-8")).hexdigest()

    @classmethod
    def create_for_profile(cls, profile, *, platform=None, ttl_hours: int | None = None):
        ttl = ttl_hours or int(getattr(settings, "PLUGIN_ACTIVATION_TOKEN_TTL_HOURS", 72))
        cls.objects.filter(profile=profile, used_at__isnull=True, revoked=False).update(revoked=True)
        plain = secrets.token_urlsafe(32)
        token_hash = cls.hash_plain_token(plain)
        subdomain_key = token_hash[:32]
        row = cls.objects.create(
            profile=profile,
            platform=platform,
            token_hash=token_hash,
            subdomain_key=subdomain_key,
            expires_at=timezone.now() + timezone.timedelta(hours=ttl),
        )
        return plain, row

    def is_valid(self) -> bool:
        if self.revoked or self.used_at:
            return False
        return timezone.now() < self.expires_at

    def mark_used(self) -> None:
        if not self.used_at:
            self.used_at = timezone.now()
            self.save(update_fields=["used_at"])
