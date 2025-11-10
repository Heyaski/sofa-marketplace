from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """Сериализатор для профиля пользователя"""
    subscription_type_display = serializers.CharField(source='get_subscription_type_display', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'subscription_type', 'subscription_type_display',
            'card_number', 'card_holder', 'card_expiry', 'card_cvv',
            'chat_notifications', 'new_models_notifications'
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'profile']
        read_only_fields = ['id', 'is_active']
    
    def update(self, instance, validated_data):
        # Извлекаем данные профиля из validated_data
        profile_data = validated_data.pop('profile', None)
        
        # Обновляем данные пользователя
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Обновляем или создаем профиль
        if profile_data is not None:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        
        return instance
    
    def to_representation(self, instance):
        """Переопределяем для правильного отображения профиля"""
        representation = super().to_representation(instance)
        # Если профиль существует, сериализуем его
        if hasattr(instance, 'profile'):
            representation['profile'] = UserProfileSerializer(instance.profile).data
        else:
            # Если профиля нет, возвращаем пустой объект с дефолтными значениями
            representation['profile'] = {
                'subscription_type': 'trial',
                'subscription_type_display': 'Пробная',
                'card_number': '',
                'card_holder': '',
                'card_expiry': '',
                'card_cvv': '',
                'chat_notifications': True,
                'new_models_notifications': False,
            }
        return representation

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'username': {'required': True},
            'email': {'required': True},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
        }

    def validate_username(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Имя пользователя не может быть пустым")
        return value.strip()

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email не может быть пустым")
        return value.strip()

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают"})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        # Создаем профиль пользователя с пробной подпиской
        UserProfile.objects.create(user=user, subscription_type='trial')
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        return token

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)