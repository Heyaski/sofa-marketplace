from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from django.db import models
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer


class ProductPagination(PageNumberPagination):
    """Пагинация для товаров"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)  # Показываем только активные товары
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации
    pagination_class = ProductPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        """
        Переопределяем queryset для поддержки фильтрации по категориям с учетом подкатегорий
        и множественного выбора для material, style, color, brand
        """
        queryset = super().get_queryset()
        
        # Фильтрация по категории
        category_id = self.request.query_params.get('category', None)
        
        if category_id:
            try:
                category_id = int(category_id)
                # Получаем категорию
                from .models import Category
                category = Category.objects.filter(id=category_id).first()
                
                if category:
                    # Если выбрана основная категория (без parent), показываем:
                    # 1. Продукты с этой категорией
                    # 2. Продукты с подкатегориями этой категории
                    if category.parent is None:
                        # Получаем все подкатегории этой категории
                        subcategories = Category.objects.filter(parent=category)
                        # Фильтруем продукты: либо категория = основная, либо категория в подкатегориях
                        queryset = queryset.filter(
                            models.Q(category=category) | 
                            models.Q(category__in=subcategories)
                        )
                    else:
                        # Если выбрана подкатегория, показываем только продукты с этой подкатегорией
                        queryset = queryset.filter(category=category)
            except (ValueError, TypeError):
                # Если category_id невалидный, игнорируем фильтр
                pass
        
        # Фильтрация по множественным значениям (material, style, color, brand)
        # Если значение содержит запятую, ищем товары, где поле содержит любое из значений
        for field in ['material', 'style', 'color', 'brand']:
            value = self.request.query_params.get(field, None)
            if value:
                # Разделяем значения по запятой
                values = [v.strip() for v in value.split(',') if v.strip()]
                if values:
                    # Создаем Q объекты для каждого значения (поиск через contains или exact)
                    q_objects = models.Q()
                    for val in values:
                        q_objects |= models.Q(**{f'{field}__icontains': val})
                    queryset = queryset.filter(q_objects)
        
        # Фильтрация по цене (обрабатываем вручную, так как DjangoFilterBackend может не работать с DecimalField)
        price_gte = self.request.query_params.get('price__gte', None)
        price_lte = self.request.query_params.get('price__lte', None)
        if price_gte:
            try:
                queryset = queryset.filter(price__gte=float(price_gte))
            except (ValueError, TypeError):
                pass
        if price_lte:
            try:
                queryset = queryset.filter(price__lte=float(price_lte))
            except (ValueError, TypeError):
                pass
        
        # Фильтрация по габаритам (обрабатываем вручную)
        width_gte = self.request.query_params.get('width__gte', None)
        width_lte = self.request.query_params.get('width__lte', None)
        if width_gte:
            try:
                queryset = queryset.filter(width__gte=float(width_gte))
            except (ValueError, TypeError):
                pass
        if width_lte:
            try:
                queryset = queryset.filter(width__lte=float(width_lte))
            except (ValueError, TypeError):
                pass
        
        depth_gte = self.request.query_params.get('depth__gte', None)
        depth_lte = self.request.query_params.get('depth__lte', None)
        if depth_gte:
            try:
                queryset = queryset.filter(depth__gte=float(depth_gte))
            except (ValueError, TypeError):
                pass
        if depth_lte:
            try:
                queryset = queryset.filter(depth__lte=float(depth_lte))
            except (ValueError, TypeError):
                pass
        
        return queryset

    # Фильтрация
    # material, style, color, brand обрабатываются вручную в get_queryset для поддержки множественного выбора
    # price, width, depth тоже обрабатываются вручную для корректной работы с DecimalField
    filterset_fields = {
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