from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import AllowAny
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    # Фильтрация
    filterset_fields = {
        "category": ["exact"],
        "material": ["exact"],
        "style": ["exact"],
        "color": ["exact"],
        "price": ["gte", "lte"],
        "is_active": ["exact"],
        "is_trending": ["exact"],
    }


    search_fields = ["title", "description"]


    ordering_fields = ["price", "title"]
    ordering = ["price"]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации

    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context