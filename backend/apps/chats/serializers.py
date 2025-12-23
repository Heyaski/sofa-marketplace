from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Chat, Message, MessageProduct, MessageBasket, ChatParticipant
from apps.catalog.serializers import ProductSerializer
from apps.baskets.serializers import BasketSerializer
from apps.baskets.models import Basket


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для пользователя в контексте чата"""
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class MessageProductSerializer(serializers.ModelSerializer):
    """Сериализатор для прикрепленного товара"""
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = MessageProduct
        fields = ['id', 'product', 'product_id', 'selected_formats']


class MessageBasketSerializer(serializers.ModelSerializer):
    """Сериализатор для прикрепленной корзины"""
    basket = BasketSerializer(read_only=True)
    basket_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = MessageBasket
        fields = ['id', 'basket', 'basket_id']


class MessageSerializer(serializers.ModelSerializer):
    """Сериализатор для сообщения"""
    sender = UserSerializer(read_only=True)
    products = MessageProductSerializer(many=True, read_only=True)
    baskets = MessageBasketSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'chat', 'sender', 'message_type', 'content',
            'created_at', 'is_read', 'products', 'baskets'
        ]
        read_only_fields = ['sender', 'created_at']


class MessageCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания сообщения"""
    product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
        allow_empty=True,
        default=list
    )
    selected_formats = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        write_only=True,
        allow_empty=True,
        default=dict
    )
    basket_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = Message
        fields = [
            'chat', 'message_type', 'content',
            'product_ids', 'selected_formats', 'basket_id'
        ]
        extra_kwargs = {
            'chat': {'required': True},
            'message_type': {'required': True},
            'content': {'required': False, 'allow_blank': True},
        }
    
    def validate_chat(self, value):
        """Проверяем, что чат существует и пользователь является участником"""
        request = self.context.get('request')
        if request and request.user:
            # Проверка будет выполнена в view
            return value
        return value
    
    def validate_basket_id(self, value):
        """Проверяем, что корзина существует и принадлежит пользователю"""
        if value is not None:
            try:
                basket = Basket.objects.get(id=value)
                # Проверяем, что пользователь является владельцем корзины
                request = self.context.get('request')
                if request and request.user:
                    # Проверяем, что корзина принадлежит текущему пользователю
                    # basket.user может быть объектом User или ID
                    basket_user_id = basket.user.id if hasattr(basket.user, 'id') else basket.user
                    if basket_user_id != request.user.id:
                        raise serializers.ValidationError("Вы можете отправлять только свои корзины")
            except Basket.DoesNotExist:
                raise serializers.ValidationError("Корзина с указанным ID не найдена")
        return value
    
    def validate_message_type(self, value):
        """Проверяем, что тип сообщения валидный"""
        valid_types = ['text', 'product', 'basket']
        if value not in valid_types:
            raise serializers.ValidationError(f"Тип сообщения должен быть одним из: {', '.join(valid_types)}")
        return value
    
    def validate(self, attrs):
        """Дополнительная валидация"""
        message_type = attrs.get('message_type')
        content = attrs.get('content', '')
        product_ids = attrs.get('product_ids', [])
        basket_id = attrs.get('basket_id')
        
        # Для текстового сообщения content не обязателен, но желателен
        if message_type == 'text' and not content.strip() and not product_ids and not basket_id:
            # Разрешаем пустое текстовое сообщение
            pass
        
        # Для сообщения с товарами должны быть product_ids
        if message_type == 'product' and not product_ids:
            raise serializers.ValidationError({"product_ids": "Для сообщения с товарами необходимо указать хотя бы один товар"})
        
        # Для сообщения с корзиной должен быть basket_id
        if message_type == 'basket' and not basket_id:
            raise serializers.ValidationError({"basket_id": "Для сообщения с корзиной необходимо указать корзину"})
        
        return attrs

    def create(self, validated_data):
        # Безопасно извлекаем опциональные поля
        product_ids = validated_data.pop('product_ids', None) or []
        selected_formats = validated_data.pop('selected_formats', None) or {}
        basket_id = validated_data.pop('basket_id', None)

        # Получаем пользователя из контекста
        user = self.context['request'].user
        
        # Создаем сообщение
        message = Message.objects.create(
            sender=user,
            **validated_data
        )

        # Добавляем товары
        if product_ids and isinstance(product_ids, list):
            for product_id in product_ids:
                formats = selected_formats.get(str(product_id), []) if selected_formats else []
                MessageProduct.objects.create(
                    message=message,
                    product_id=product_id,
                    selected_formats=formats
                )

        # Добавляем корзину
        if basket_id:
            MessageBasket.objects.create(
                message=message,
                basket_id=basket_id
            )

        return message


class ChatParticipantSerializer(serializers.ModelSerializer):
    """Сериализатор для участника чата"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatParticipant
        fields = ['id', 'user', 'joined_at', 'is_admin']
        read_only_fields = ['joined_at']


class ChatSerializer(serializers.ModelSerializer):
    """Сериализатор для чата"""
    participant1 = UserSerializer(read_only=True)
    participant2 = UserSerializer(read_only=True)
    participants_list = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Chat
        fields = [
            'id', 'chat_type', 'name', 'participant1', 'participant2',
            'participants_list', 'created_at', 'updated_at', 'is_pinned',
            'last_message', 'unread_count', 'other_participant', 'created_by'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_participants_list(self, obj):
        """Получить список всех участников чата"""
        if obj.chat_type == 'group':
            # Для групповых чатов получаем участников через ChatParticipant
            participants = obj.participants.all()
            return [UserSerializer(participant.user).data for participant in participants]
        else:
            # Для приватных чатов используем старую логику
            participants = obj.get_all_participants()
            return UserSerializer(participants, many=True).data

    def get_last_message(self, obj):
        last_msg = obj.messages.last()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.get_unread_count(request.user)
        return 0

    def get_other_participant(self, obj):
        """Для приватных чатов возвращает другого участника"""
        request = self.context.get('request')
        if request and request.user and obj.chat_type == 'private':
            other = obj.get_other_participant(request.user)
            return UserSerializer(other).data if other else None
        return None


class ChatCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания чата"""
    participant2_id = serializers.IntegerField(write_only=True, required=False)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Chat
        fields = ['participant2_id', 'participant_ids', 'name', 'chat_type']

    def validate(self, attrs):
        """Валидация данных для создания чата"""
        chat_type = attrs.get('chat_type', 'private')
        participant2_id = attrs.get('participant2_id')
        participant_ids = attrs.get('participant_ids', [])
        
        if chat_type == 'private':
            if not participant2_id:
                raise serializers.ValidationError("Для приватного чата необходимо указать participant2_id")
        elif chat_type == 'group':
            if not participant_ids:
                raise serializers.ValidationError("Для группового чата необходимо указать хотя бы одного участника")
            if not attrs.get('name'):
                raise serializers.ValidationError("Для группового чата необходимо указать название")
        
        return attrs

    def create(self, validated_data):
        chat_type = validated_data.get('chat_type', 'private')
        participant2_id = validated_data.pop('participant2_id', None)
        participant_ids = validated_data.pop('participant_ids', [])
        name = validated_data.pop('name', None)
        creator = self.context['request'].user

        if chat_type == 'private':
            # Создание приватного чата (старая логика)
            participant1 = creator
            
            # Проверяем, существует ли уже чат
            chat = Chat.objects.filter(
                participant1=participant1,
                participant2_id=participant2_id,
                chat_type='private'
            ).first()

            if not chat:
                chat = Chat.objects.filter(
                    participant1_id=participant2_id,
                    participant2=participant1,
                    chat_type='private'
                ).first()

            if not chat:
                chat = Chat.objects.create(
                    chat_type='private',
                    participant1=participant1,
                    participant2_id=participant2_id,
                    created_by=creator
                )
        else:
            # Создание группового чата
            chat = Chat.objects.create(
                chat_type='group',
                name=name,
                created_by=creator
            )
            
            # Добавляем создателя как участника и администратора
            ChatParticipant.objects.create(
                chat=chat,
                user=creator,
                is_admin=True
            )
            
            # Добавляем остальных участников
            for user_id in participant_ids:
                if user_id != creator.id:  # Создатель уже добавлен
                    ChatParticipant.objects.get_or_create(
                        chat=chat,
                        user_id=user_id
                    )

        return chat

