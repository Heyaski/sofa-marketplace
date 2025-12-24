from django.db import models
from django.utils.text import slugify


class StaticPage(models.Model):
    """Модель для статических страниц (политика конфиденциальности, договор-оферта и т.д.)"""
    
    PAGE_TYPES = [
        ('privacy', 'Политика конфиденциальности'),
        ('terms', 'Договор-оферта'),
        ('about', 'О нас'),
        ('contact', 'Контакты'),
        ('other', 'Другое'),
    ]
    
    page_type = models.CharField(
        max_length=20,
        choices=PAGE_TYPES,
        unique=True,
        verbose_name='Тип страницы'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Заголовок'
    )
    content = models.TextField(
        verbose_name='Содержание',
        help_text='HTML контент страницы'
    )
    slug = models.SlugField(
        max_length=200,
        unique=True,
        blank=True,
        verbose_name='URL-адрес',
        help_text='Автоматически генерируется из заголовка'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Активна'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создана'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Обновлена'
    )
    
    class Meta:
        verbose_name = 'Статическая страница'
        verbose_name_plural = 'Статические страницы'
        ordering = ['page_type']
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)
            slug = base_slug
            counter = 1
            # Убеждаемся, что slug уникален
            while StaticPage.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

