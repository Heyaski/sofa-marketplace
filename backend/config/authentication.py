"""
JWT аутентификация, которая при невалидном/истёкшем токене 
не возвращает 401, а устанавливает AnonymousUser.
Это позволяет AllowAny-эндпоинтам (products, categories) работать
даже когда пользователь передаёт истёкший токен.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth.models import AnonymousUser


class OptionalJWTAuthentication(JWTAuthentication):
    """
    Аутентифицирует по JWT если токен валидный.
    При невалидном/истёкшем токене — возвращает AnonymousUser (не 401).
    """
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return (AnonymousUser(), None)
