from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product
from apps.baskets.models import Basket


class Chat(models.Model):
    """Модель чата между двумя пользователями"""
    participant1 = models.ForeignKey(
        User,
        related_name="chats_as_participant1",
        on_delete=models.CASCADE
    )
    participant2 = models.ForeignKey(
        User,
        related_name="chats_as_participant2",
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_pinned = models.BooleanField(default=False)

    class Meta:
        unique_together = [['participant1', 'participant2']]
        ordering = ['-updated_at']

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

    chat = models.ForeignKey(Chat, related_name="messages", on_delete=models.CASCADE)
    sender = models.ForeignKey(User, related_name="sent_messages", on_delete=models.CASCADE)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Сообщение от {self.sender.username} в чате {self.chat.id}"


class MessageProduct(models.Model):
    """Модель для прикрепленного товара в сообщении"""
    message = models.ForeignKey(Message, related_name="products", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    selected_formats = models.JSONField(default=list)  # Список выбранных форматов, например [".fbx", ".glb"]

    def __str__(self):
        return f"Товар {self.product.title} в сообщении {self.message.id}"


class MessageBasket(models.Model):
    """Модель для прикрепленной корзины в сообщении"""
    message = models.ForeignKey(Message, related_name="baskets", on_delete=models.CASCADE)
    basket = models.ForeignKey(Basket, on_delete=models.CASCADE)

    def __str__(self):
        return f"Корзина {self.basket.name} в сообщении {self.message.id}"

