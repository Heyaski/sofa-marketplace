from django.contrib import admin
from .models import Chat, Message, MessageProduct, MessageBasket, ChatParticipant
from apps.admin_utils import ExportExcelMixin


@admin.register(Chat)
class ChatAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'chat_type', 'name', 'participant1', 'participant2', 'created_at', 'updated_at', 'is_pinned')
    list_filter = ('chat_type', 'created_at', 'is_pinned')
    search_fields = ('name', 'participant1__username', 'participant2__username')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'
    actions = ["export_selected_to_excel"]


@admin.register(ChatParticipant)
class ChatParticipantAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'chat', 'user', 'is_admin', 'joined_at')
    list_filter = ('is_admin', 'joined_at')
    search_fields = ('chat__name', 'user__username')
    readonly_fields = ('joined_at',)
    actions = ["export_selected_to_excel"]


@admin.register(Message)
class MessageAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'chat', 'sender', 'message_type', 'created_at', 'is_read')
    list_filter = ('message_type', 'is_read', 'created_at')
    search_fields = ('content', 'sender__username')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'
    actions = ["export_selected_to_excel"]


@admin.register(MessageProduct)
class MessageProductAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'message', 'product', 'selected_formats')
    search_fields = ('product__title', 'product__article')
    actions = ["export_selected_to_excel"]


@admin.register(MessageBasket)
class MessageBasketAdmin(ExportExcelMixin, admin.ModelAdmin):
    list_display = ('id', 'message', 'basket')
    search_fields = ('basket__name', 'basket__user__username')
    actions = ["export_selected_to_excel"]

