from django.contrib import admin
from .models import Chat, Message, MessageProduct, MessageBasket


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ('id', 'participant1', 'participant2', 'created_at', 'updated_at', 'is_pinned')
    list_filter = ('created_at', 'is_pinned')
    search_fields = ('participant1__username', 'participant2__username')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'chat', 'sender', 'message_type', 'created_at', 'is_read')
    list_filter = ('message_type', 'is_read', 'created_at')
    search_fields = ('content', 'sender__username')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'


@admin.register(MessageProduct)
class MessageProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'product', 'selected_formats')
    search_fields = ('product__title', 'product__article')


@admin.register(MessageBasket)
class MessageBasketAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'basket')
    search_fields = ('basket__name', 'basket__user__username')

