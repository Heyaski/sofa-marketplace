from django.contrib import admin
from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "category", "price", "material", "style", "color", "is_active")
    list_filter = ("category", "material", "style", "color", "is_active")
    search_fields = ("title", "description")
    list_editable = ("price", "is_active")
