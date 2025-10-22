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

    # Фильтрация
    filterset_fields = {
        "category": ["exact"],
        "material": ["exact"],
        "style": ["exact"],
        "color": ["exact"],
        "price": ["gte", "lte"],
        "is_active": ["exact"],
    }


    search_fields = ["title", "description"]


    ordering_fields = ["price", "title"]
    ordering = ["price"]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации
