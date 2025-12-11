from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product
from apps.baskets.models import Basket


class Chat(models.Model):
    """Модель чата между двумя пользователями"""
    participant1 = models.ForeignKey(
        User,
        related_name="chats_as_participant1",
        on_delete=models.CASCADE,
        verbose_name="Участник 1"
    )
    participant2 = models.ForeignKey(
        User,
        related_name="chats_as_participant2",
        on_delete=models.CASCADE,
        verbose_name="Участник 2"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    is_pinned = models.BooleanField(default=False, verbose_name="Закреплён")

    class Meta:
        unique_together = [['participant1', 'participant2']]
        ordering = ['-updated_at']
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"

    def __str__(self):
        return f"Чат между {self.participant1.username} и {self.participant2.username}"

    def get_other_participant(self, user):
        """Получить другого участника чата"""
        if user == self.participant1:
            return self.participant2
        return self.participant1

    def get_unread_count(self, user):
        """Получить количество непрочитанных сообщений для пользователя"""
        from django.db.models import Q
        return self.messages.filter(
            ~Q(sender=user),
            is_read=False
        ).count()


class Message(models.Model):
    """Модель сообщения в чате"""
    MESSAGE_TYPES = [
        ('text', 'Текст'),
        ('product', 'Товар'),
        ('basket', 'Корзина'),
    ]

    chat = models.ForeignKey(Chat, related_name="messages", on_delete=models.CASCADE, verbose_name="Чат")
    sender = models.ForeignKey(User, related_name="sent_messages", on_delete=models.CASCADE, verbose_name="Отправитель")
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text', verbose_name="Тип сообщения")
    content = models.TextField(blank=True, verbose_name="Содержание")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    is_read = models.BooleanField(default=False, verbose_name="Прочитано")

    class Meta:
        ordering = ['created_at']
        verbose_name = "Сообщение"
        verbose_name_plural = "Сообщения"

    def __str__(self):
        return f"Сообщение от {self.sender.username} в чате {self.chat.id}"


class MessageProduct(models.Model):
    """Модель для прикрепленного товара в сообщении"""
    message = models.ForeignKey(Message, related_name="products", on_delete=models.CASCADE, verbose_name="Сообщение")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    selected_formats = models.JSONField(default=list, verbose_name="Выбранные форматы")  # Список выбранных форматов, например [".fbx", ".glb"]

    class Meta:
        verbose_name = "Товар в сообщении"
        verbose_name_plural = "Товары в сообщениях"

    def __str__(self):
        return f"Товар {self.product.title} в сообщении {self.message.id}"


class MessageBasket(models.Model):
    """Модель для прикрепленной корзины в сообщении"""
    message = models.ForeignKey(Message, related_name="baskets", on_delete=models.CASCADE, verbose_name="Сообщение")
    basket = models.ForeignKey(Basket, on_delete=models.CASCADE, verbose_name="Корзина")

    class Meta:
        verbose_name = "Корзина в сообщении"
        verbose_name_plural = "Корзины в сообщениях"

    def __str__(self):
        return f"Корзина {self.basket.name} в сообщении {self.message.id}"

