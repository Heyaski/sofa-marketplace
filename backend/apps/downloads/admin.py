from django.contrib import admin
from .models import Download

@admin.register(Download)
class DownloadAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at", "file")
    list_filter = ("created_at",)
    search_fields = ("user__username", "user__email", "product__title", "product__article")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
