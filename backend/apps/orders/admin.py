from django.contrib import admin
from .models import Order, OrderItem
from apps.admin_utils import ExportExcelMixin


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    verbose_name = "Элемент заказа"
    verbose_name_plural = "Элементы заказа"


@admin.register(Order)
class OrderAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ("id", "user", "status", "total_price", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__username", "user__email", "id")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]
    actions = ["export_selected_to_excel"]