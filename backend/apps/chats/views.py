from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Max
from django.contrib.auth.models import User

from .models import Chat, Message
from .serializers import (
    ChatSerializer,
    ChatCreateSerializer,
    MessageSerializer,
    MessageCreateSerializer
)


class ChatViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с чатами"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ChatCreateSerializer
        return ChatSerializer

    def get_queryset(self):
        """Получить все чаты текущего пользователя"""
        user = self.request.user
        return Chat.objects.filter(
            Q(participant1=user) | Q(participant2=user)
        ).annotate(
            last_message_time=Max('messages__created_at')
        ).order_by('-last_message_time', '-updated_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['post'])
    def toggle_pin(self, request, pk=None):
        """Закрепить/открепить чат"""
        chat = self.get_object()
        chat.is_pinned = not chat.is_pinned
        chat.save()
        return Response({'is_pinned': chat.is_pinned})


class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с сообщениями"""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer

    def get_queryset(self):
        """Получить сообщения для чата"""
        chat_id = self.request.query_params.get('chat_id')
        if chat_id:
            # Проверяем, что пользователь является участником чата
            chat = Chat.objects.filter(
                Q(id=chat_id) & (
                    Q(participant1=self.request.user) |
                    Q(participant2=self.request.user)
                )
            ).first()
            if chat:
                return Message.objects.filter(chat=chat)
        return Message.objects.none()

    def perform_create(self, serializer):
        """Создать сообщение"""
        # sender устанавливается в сериализаторе, поэтому просто сохраняем
        serializer.save()
    
    def create(self, request, *args, **kwargs):
        """Переопределяем create, чтобы вернуть полный объект с sender"""
        # Проверяем, что пользователь имеет доступ к чату
        chat_id = request.data.get('chat')
        if chat_id:
            try:
                # Преобразуем в число, если это строка
                chat_id = int(chat_id) if isinstance(chat_id, str) else chat_id
                chat = Chat.objects.filter(
                    Q(id=chat_id) & (
                        Q(participant1=request.user) |
                        Q(participant2=request.user)
                    )
                ).first()
                if not chat:
                    return Response(
                        {'error': 'Чат не найден или у вас нет доступа к этому чату'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except (ValueError, TypeError) as e:
                return Response(
                    {'error': f'Неверный ID чата: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Возвращаем созданное сообщение через MessageSerializer для полной информации
        message = serializer.instance
        response_serializer = MessageSerializer(message, context={'request': request})
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Отметить сообщение как прочитанное"""
        message = self.get_object()
        # Отмечаем как прочитанное только если получатель - текущий пользователь
        if message.sender != request.user:
            message.is_read = True
            message.save()
        return Response({'is_read': message.is_read})

    @action(detail=False, methods=['post'])
    def mark_chat_read(self, request):
        """Отметить все сообщения в чате как прочитанные"""
        chat_id = request.data.get('chat_id')
        if not chat_id:
            return Response(
                {'error': 'chat_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        chat = Chat.objects.filter(
            Q(id=chat_id) & (
                Q(participant1=request.user) |
                Q(participant2=request.user)
            )
        ).first()

        if not chat:
            return Response(
                {'error': 'Chat not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Отмечаем все непрочитанные сообщения от другого участника
        Message.objects.filter(
            chat=chat
        ).exclude(
            sender=request.user
        ).filter(
            is_read=False
        ).update(is_read=True)

        return Response({'status': 'Messages marked as read'})

