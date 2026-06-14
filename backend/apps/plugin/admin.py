from django.contrib import admin

from .models import PluginActivationToken, PluginPlatform


@admin.register(PluginPlatform)
class PluginPlatformAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "api_base_url", "database_alias", "is_default", "is_active", "sort_order")
    list_filter = ("is_active", "is_default")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(PluginActivationToken)
class PluginActivationTokenAdmin(admin.ModelAdmin):
    list_display = ("subdomain_key", "profile", "platform", "created_at", "expires_at", "used_at", "revoked")
    list_filter = ("revoked", "platform")
    search_fields = ("subdomain_key", "profile__user__email", "profile__user__username")
    readonly_fields = ("token_hash", "subdomain_key", "created_at")
