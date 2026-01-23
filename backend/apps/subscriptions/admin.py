from django.contrib import admin
from .models import Plan, Subscription
from apps.admin_utils import ExportExcelMixin


@admin.register(Plan)
class PlanAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'name', 'subscription_type', 'price', 'duration_days', 'is_active')
    list_filter = ('subscription_type', 'is_active', 'duration_days')
    search_fields = ('name', 'description', 'subscription_type')
    list_editable = ('price', 'duration_days', 'is_active')
    actions = ["export_selected_to_excel"]
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'subscription_type', 'is_active')
        }),
        ('Цена и длительность', {
            'fields': ('price', 'duration_days')
        }),
        ('Описание', {
            'fields': ('description',),
            'description': 'Описание будет использоваться в чеке при оплате'
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        # subscription_type можно изменить только при создании
        if obj:  # редактирование существующего объекта
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
