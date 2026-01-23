from django.contrib import admin
from .models import Basket, BasketItem, BasketEditRequest
from apps.admin_utils import ExportExcelMixin


@admin.register(Basket)
class BasketAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'user', 'name', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('name', 'user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    actions = ["export_selected_to_excel"]


@admin.register(BasketItem)
class BasketItemAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'basket', 'product', 'quantity', 'format')
    list_filter = ('format',)
    search_fields = ('basket__name', 'product__title', 'product__article')
    actions = ["export_selected_to_excel"]


@admin.register(BasketEditRequest)
class BasketEditRequestAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'basket', 'requester', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('basket__name', 'requester__username', 'requester__email')
    readonly_fields = ('created_at', 'updated_at')
    actions = ["export_selected_to_excel"]