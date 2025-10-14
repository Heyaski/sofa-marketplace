from django.contrib import admin
from .models import Download

@admin.register(Download)
class DownloadAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "product__title")
