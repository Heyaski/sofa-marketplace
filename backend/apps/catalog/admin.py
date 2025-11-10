from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent", "preview_image")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}

    # красивый предпросмотр картинки
    def preview_image(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="60" height="60" style="object-fit:cover;border-radius:6px; box-shadow:0 0 4px rgba(0,0,0,0.15);"/>',
                obj.image.url
            )
        return "—"

    preview_image.short_description = "Изображение"


class ProductImageInline(admin.TabularInline):
    """Inline для загрузки нескольких изображений товара"""
    model = ProductImage
    extra = 1
    fields = ('image', 'order', 'preview')
    readonly_fields = ('preview',)

    def preview(self, obj):
        if obj.pk and obj.image:
            return format_html(
                '<img src="{}" width="100" height="100" style="object-fit:cover;border-radius:6px;"/>',
                obj.image.url
            )
        return "—"
    preview.short_description = "Предпросмотр"


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "category",
        "price",
        "material",
        "style",
        "color",
        "is_active",
        "is_trending",
    )
    list_filter = ("category", "material", "style", "color", "is_active", "is_trending")
    search_fields = ("title", "description")
    list_editable = ("price", "is_active", "is_trending")
    inlines = [ProductImageInline]
