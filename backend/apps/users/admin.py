from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Профиль'
    fields = ('subscription_type', 'card_number', 'card_holder', 'card_expiry', 'card_cvv', 
              'chat_notifications', 'new_models_notifications')


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


# Перерегистрируем UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'subscription_type', 'card_number', 'chat_notifications', 'new_models_notifications')
    search_fields = ('user__username', 'user__email', 'card_holder')
    list_filter = ('subscription_type', 'chat_notifications', 'new_models_notifications')
    fieldsets = (
        ('Пользователь', {
            'fields': ('user',)
        }),
        ('Подписка', {
            'fields': ('subscription_type',)
        }),
        ('Данные карты', {
            'fields': ('card_number', 'card_holder', 'card_expiry', 'card_cvv'),
            'classes': ('collapse',)
        }),
        ('Настройки уведомлений', {
            'fields': ('chat_notifications', 'new_models_notifications')
        }),
    )

