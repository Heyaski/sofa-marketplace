from django.contrib import admin
from .models import Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'price', 'duration_days')
    list_filter = ('duration_days',)
    search_fields = ('name',)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'start_date', 'end_date', 'is_active')
    list_filter = ('plan', 'start_date', 'end_date')
    search_fields = ('user__username', 'user__email', 'plan__name')
    readonly_fields = ('start_date',)
    date_hierarchy = 'start_date'
    
    def is_active(self, obj):
        return obj.is_active()
    is_active.boolean = True
    is_active.short_description = "Активна"
