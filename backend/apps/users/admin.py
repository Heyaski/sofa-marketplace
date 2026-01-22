from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from .models import UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = 'Профиль'
    verbose_name_plural = 'Профили'
    fields = (
        'subscription_type', 
        'subscription_start_date', 
        'subscription_end_date',
        'auto_renewal',
        'yookassa_payment_id',
        'card_number', 
        'card_holder', 
        'card_expiry', 
        'card_cvv', 
        'chat_notifications', 
        'new_models_notifications'
    )


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# Перерегистрируем UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user', 
        'subscription_type', 
        'subscription_start_date', 
        'subscription_end_date',
        'is_subscription_active_display',
        'auto_renewal',
        'chat_notifications'
    )
    search_fields = ('user__username', 'user__email', 'card_holder', 'yookassa_payment_id')
    list_filter = (
        'subscription_type', 
        'auto_renewal',
        'chat_notifications', 
        'new_models_notifications',
        'subscription_start_date',
        'subscription_end_date'
    )
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'subscription_start_date'
    
    fieldsets = (
        ('Пользователь', {
            'fields': ('user',)
        }),
        ('Подписка', {
            'fields': (
                'subscription_type',
                'subscription_start_date',
                'subscription_end_date',
                'auto_renewal',
                'yookassa_payment_id'
            ),
            'description': 'Управление подпиской пользователя. Можно редактировать даты начала и окончания подписки.'
        }),
        ('Данные карты', {
            'fields': ('card_number', 'card_holder', 'card_expiry', 'card_cvv'),
            'classes': ('collapse',)
        }),
        ('Настройки уведомлений', {
            'fields': ('chat_notifications', 'new_models_notifications')
        }),
        ('Системная информация', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_subscription_active_display(self, obj):
        """Отображает статус активности подписки"""
        if obj.is_subscription_active():
            return "✅ Активна"
        else:
            return "❌ Неактивна"
    is_subscription_active_display.short_description = 'Статус подписки'
    is_subscription_active_display.boolean = False


# Русификация стандартных моделей Django
admin.site.unregister(Group)
@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    pass

# Добавляем русские названия для стандартных моделей
User._meta.verbose_name = "Пользователь"
User._meta.verbose_name_plural = "Пользователи"
Group._meta.verbose_name = "Группа"
Group._meta.verbose_name_plural = "Группы"

