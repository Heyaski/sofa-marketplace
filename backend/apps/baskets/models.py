from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product
import uuid
import os


class Basket(models.Model):
    user = models.ForeignKey(User, related_name="baskets", on_delete=models.CASCADE, verbose_name="Пользователь")
    name = models.CharField(max_length=255, default="Новая корзина", verbose_name="Название")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True, verbose_name="Токен для публичной ссылки")
    
    class Meta:
        verbose_name = "Корзина"
        verbose_name_plural = "Корзины"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.user.username}"
    
    def generate_share_token(self):
        """Генерирует уникальный токен для публичной ссылки"""
        if not self.share_token:
            self.share_token = uuid.uuid4().hex
            self.save(update_fields=['share_token'])
        return self.share_token
    
    def get_share_url(self, request=None):
        """Получить публичную ссылку на корзину"""
        if not self.share_token:
            self.generate_share_token()
        if request:
            # Получаем базовый URL
            base_url = request.build_absolute_uri('/').rstrip('/')
            # Убираем поддомен api. из хоста
            if '://api.' in base_url:
                base_url = base_url.replace('://api.', '://')
            # Убираем /api если есть в конце
            if base_url.endswith('/api'):
                base_url = base_url[:-4]
            # Убираем /api/ из середины URL если есть
            base_url = base_url.replace('/api/', '/')
            return f'{base_url}/basket/share/{self.share_token}/'
        return f'/basket/share/{self.share_token}/'


class BasketItem(models.Model):
    basket = models.ForeignKey(Basket, related_name="items", on_delete=models.CASCADE, verbose_name="Корзина")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    format = models.CharField(max_length=10, blank=True, null=True, verbose_name="Формат")

    class Meta:
        verbose_name = "Элемент корзины"
        verbose_name_plural = "Элементы корзины"

    def __str__(self):
        return f"{self.product.title} x {self.quantity} ({self.format or 'без формата'})"


class BasketEditRequest(models.Model):
    """Модель для запросов на редактирование корзины"""
    STATUS_CHOICES = [
        ('pending', 'Ожидает рассмотрения'),
        ('approved', 'Одобрено'),
        ('rejected', 'Отклонено'),
    ]
    
    basket = models.ForeignKey(Basket, related_name="edit_requests", on_delete=models.CASCADE, verbose_name="Корзина")
    requester = models.ForeignKey(User, related_name="basket_edit_requests", on_delete=models.CASCADE, verbose_name="Запрашивающий")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    message = models.TextField(blank=True, verbose_name="Сообщение")
    
    class Meta:
        verbose_name = "Запрос на редактирование корзины"
        verbose_name_plural = "Запросы на редактирование корзины"
        ordering = ['-created_at']
        unique_together = [['basket', 'requester', 'status']]  # Один активный запрос на пару корзина-пользователь
    
    def __str__(self):
        return f"Запрос от {self.requester.username} на корзину {self.basket.name} ({self.get_status_display()})"


def cp_file_upload_path(instance, filename):
    """Путь для сохранения PDF файлов коммерческих предложений"""
    return os.path.join('commercial_proposals', f'cp_{instance.id or "new"}_{filename}')


class CommercialProposalRequest(models.Model):
    """Модель для хранения запросов на коммерческое предложение"""
    DELIVERY_METHOD_CHOICES = [
        ('email', 'Email'),
        ('telegram', 'Telegram'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Ожидает генерации'),
        ('generated', 'Сгенерировано'),
        ('sent', 'Отправлено'),
        ('failed', 'Ошибка'),
    ]
    
    basket = models.ForeignKey(Basket, related_name="commercial_proposals", on_delete=models.CASCADE, verbose_name="Корзина")
    user = models.ForeignKey(User, related_name="commercial_proposals", on_delete=models.CASCADE, verbose_name="Пользователь")
    
    # Контактные данные (собираем при запросе)
    client_name = models.CharField(max_length=255, verbose_name="Имя клиента")
    company_name = models.CharField(max_length=255, blank=True, verbose_name="Название компании/студии", help_text="Название студии или компании пользователя")
    email = models.EmailField(blank=True, verbose_name="Email для отправки")
    telegram = models.CharField(max_length=255, blank=True, verbose_name="Telegram для отправки", help_text="Username или ID в Telegram")
    
    # Метод доставки
    delivery_method = models.CharField(max_length=10, choices=DELIVERY_METHOD_CHOICES, default='email', verbose_name="Способ отправки")
    
    # Название проекта (берется из названия корзины)
    project_name = models.CharField(max_length=255, verbose_name="Название проекта")
    
    # Статус
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending', verbose_name="Статус")
    
    # Сгенерированный PDF
    pdf_file = models.FileField(upload_to='commercial_proposals/', blank=True, null=True, verbose_name="PDF файл КП")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    
    class Meta:
        verbose_name = "Коммерческое предложение"
        verbose_name_plural = "Коммерческие предложения"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"КП #{self.id} - {self.project_name} ({self.get_status_display()})"
