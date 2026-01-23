from django.contrib import admin
from django.utils.html import format_html
from django import forms
from .models import StaticPage
from apps.admin_utils import ExportExcelMixin


class StaticPageAdminForm(forms.ModelForm):
    """Форма для редактирования статических страниц с улучшенным полем content"""
    
    class Meta:
        model = StaticPage
        fields = '__all__'
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': 30,
                'cols': 100,
                'style': 'font-family: monospace; font-size: 13px; width: 100%;',
                'placeholder': 'Введите HTML контент страницы. Можно использовать теги: <p>, <h1>-<h6>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <br> и др.'
            }),
            'title': forms.TextInput(attrs={
                'style': 'width: 100%; max-width: 600px;'
            }),
        }


@admin.register(StaticPage)
class StaticPageAdmin(ExportExcelMixin, admin.ModelAdmin):
    form = StaticPageAdminForm
    list_display = ('page_type', 'title', 'is_active', 'updated_at', 'preview_content')
    list_filter = ('page_type', 'is_active', 'created_at', 'updated_at')
    search_fields = ('title', 'content')
    list_editable = ('is_active',)
    readonly_fields = ('created_at', 'updated_at', 'slug')
    actions = ["export_selected_to_excel"]
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('page_type', 'title', 'slug', 'is_active')
        }),
        ('Содержание', {
            'fields': ('content',),
            'description': '''
                <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>Инструкция по редактированию:</strong><br>
                    Используйте HTML для форматирования текста. Разрешенные теги:<br>
                    • Заголовки: &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, &lt;h4&gt;, &lt;h5&gt;, &lt;h6&gt;<br>
                    • Параграфы: &lt;p&gt;<br>
                    • Списки: &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;<br>
                    • Форматирование: &lt;strong&gt;, &lt;em&gt;, &lt;b&gt;, &lt;i&gt;<br>
                    • Ссылки: &lt;a href="..."&gt;текст&lt;/a&gt;<br>
                    • Переносы: &lt;br&gt;<br>
                    • Разделители: &lt;hr&gt;<br>
                    <strong style="color: #d32f2f;">⚠️ Не используйте JavaScript и небезопасные теги!</strong>
                </div>
            '''
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def preview_content(self, obj):
        """Показывает превью содержимого страницы"""
        if obj.content:
            # Убираем HTML теги для превью
            import re
            text = re.sub(r'<[^>]+>', '', obj.content)
            preview = text[:150] + '...' if len(text) > 150 else text
            return format_html('<span style="color: #666; font-size: 12px;">{}</span>', preview)
        return format_html('<span style="color: #999;">—</span>')
    preview_content.short_description = 'Превью содержимого'

