from django.db import models
from django.contrib.auth.models import User
from apps.catalog.models import Product
from apps.baskets.models import Basket


class Chat(models.Model):
    """Модель чата между пользователями (поддерживает групповые чаты)"""
    CHAT_TYPES = [
        ('private', 'Приватный'),
        ('group', 'Групповой'),
    ]
    
    chat_type = models.CharField(max_length=10, choices=CHAT_TYPES, default='private', verbose_name="Тип чата")
    name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Название (для групповых чатов)")
    participant1 = models.ForeignKey(
        User,
        related_name="chats_as_participant1",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Участник 1 (для обратной совместимости)"
    )
    participant2 = models.ForeignKey(
        User,
        related_name="chats_as_participant2",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Участник 2 (для обратной совместимости)"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")
    is_pinned = models.BooleanField(default=False, verbose_name="Закреплён")
    created_by = models.ForeignKey(
        User,
        related_name="created_chats",
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Создатель чата"
    )

    class Meta:
        ordering = ['-updated_at']
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"

    def __str__(self):
        if self.chat_type == 'group' and self.name:
            return f"Групповой чат: {self.name}"
        elif self.participant1 and self.participant2:
            return f"Чат между {self.participant1.username} и {self.participant2.username}"
        return f"Чат {self.id}"

    def get_other_participant(self, user):
        """Получить другого участника чата (для приватных чатов)"""
        if self.chat_type == 'group':
            return None
        if user == self.participant1:
            return self.participant2
        return self.participant1
    
    def get_all_participants(self):
        """Получить всех участников чата"""
        participants = set()
        if self.participant1:
            participants.add(self.participant1)
        if self.participant2:
            participants.add(self.participant2)
        # Добавляем участников из ChatParticipant (получаем user из каждого ChatParticipant)
        for chat_participant in self.participants.all():
            participants.add(chat_participant.user)
        return list(participants)
    
    def is_participant(self, user):
        """Проверить, является ли пользователь участником чата"""
        if self.chat_type == 'private':
            return user == self.participant1 or user == self.participant2
        return user in self.get_all_participants()

    def get_unread_count(self, user):
        """Получить количество непрочитанных сообщений для пользователя"""
        from django.db.models import Q
        return self.messages.filter(
            ~Q(sender=user),
            is_read=False
        ).count()


class ChatParticipant(models.Model):
    """Модель для участников группового чата"""
    chat = models.ForeignKey(Chat, related_name="participants", on_delete=models.CASCADE, verbose_name="Чат")
    user = models.ForeignKey(User, related_name="chat_participations", on_delete=models.CASCADE, verbose_name="Пользователь")
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата присоединения")
    is_admin = models.BooleanField(default=False, verbose_name="Администратор")
    
    class Meta:
        unique_together = [['chat', 'user']]
        verbose_name = "Участник чата"
        verbose_name_plural = "Участники чатов"
    
    def __str__(self):
        return f"{self.user.username} в чате {self.chat.id}"


class Message(models.Model):
    """Модель сообщения в чате"""
    MESSAGE_TYPES = [
        ('text', 'Текст'),
        ('product', 'Товар'),
        ('basket', 'Корзина'),
        ('voice', 'Голосовое'),
    ]

    chat = models.ForeignKey(Chat, related_name="messages", on_delete=models.CASCADE, verbose_name="Чат")
    sender = models.ForeignKey(User, related_name="sent_messages", on_delete=models.CASCADE, verbose_name="Отправитель")
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text', verbose_name="Тип сообщения")
    content = models.TextField(blank=True, verbose_name="Содержание")
    voice_file = models.FileField(
        upload_to='chat_voice/',
        blank=True,
        null=True,
        verbose_name="Голосовое сообщение",
    )
    voice_duration = models.PositiveIntegerField(
        default=0,
        verbose_name="Длительность голосового (сек)",
    )
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

