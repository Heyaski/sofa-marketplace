from django.contrib import admin
from .models import Plan, Subscription
from apps.admin_utils import ExportExcelMixin


@admin.register(Plan)
class PlanAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'order', 'name', 'subscription_type', 'price', 'price_yearly', 'price_yearly_per_month', 'duration_days', 'is_active')
    list_filter = ('subscription_type', 'is_active')
    search_fields = ('name', 'description', 'subscription_type', 'revit_access', 'script_access', 'highpoly_access', 'limits')
    list_editable = ('order', 'price', 'price_yearly', 'price_yearly_per_month', 'duration_days', 'is_active')
    ordering = ('order', 'subscription_type')
    actions = ["export_selected_to_excel"]
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'subscription_type', 'order', 'is_active')
        }),
        ('Цены', {
            'fields': ('price', 'price_yearly', 'price_yearly_per_month', 'duration_days'),
            'description': 'price — помесячно, price_yearly — сумма за год, price_yearly_per_month — показываемая цена/мес при годовой оплате'
        }),
        ('Доступ по тарифу (для таблицы на сайте)', {
            'fields': ('revit_access', 'script_access', 'highpoly_access', 'limits')
        }),
        ('Описание для чека', {
            'fields': ('description',),
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ('subscription_type',)
        return ()


@admin.register(Subscription)
class SubscriptionAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'start_date', 'end_date', 'is_active')
    list_filter = ('plan', 'start_date', 'end_date')
    search_fields = ('user__username', 'user__email', 'plan__name')
    readonly_fields = ('start_date',)
    date_hierarchy = 'start_date'
    actions = ["export_selected_to_excel"]
    
    def is_active(self, obj):
        return obj.is_active()
    is_active.boolean = True
    is_active.short_description = "Активна"
