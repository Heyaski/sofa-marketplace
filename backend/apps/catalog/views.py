from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
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
    max_page_size = 1000  # Увеличиваем максимальный размер страницы для загрузки всех товаров


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)  # Показываем только активные товары
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации
    pagination_class = ProductPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_serializer_context(self):
        """Добавляем request и action в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        context['view_action'] = self.action
        return context

    def get_queryset(self):
        """
        Переопределяем queryset для поддержки фильтрации по категориям с учетом подкатегорий
        и множественного выбора для material, style, color, brand
        """
        # Получаем базовый queryset (уже отфильтрованный по is_active=True)
        queryset = Product.objects.filter(is_active=True)
        
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
        
        # Фильтрация по color_rgb
        # Поддерживаются два формата:
        # 1) "r,g,b"  — старый формат, поиск по подстроке
        # 2) "min-max" — новый формат: диапазон яркости (0–255), где яркость = (r+g+b)/3
        color_rgb = self.request.query_params.get('color_rgb', None)
        if color_rgb and color_rgb.strip():
            value = color_rgb.strip()
            if '-' in value:
                try:
                    # Новый формат "min-max"
                    parts = value.split('-', 1)
                    brightness_min = max(0, min(255, int(parts[0])))
                    brightness_max = max(0, min(255, int(parts[1])))
                    if brightness_min > brightness_max:
                        brightness_min, brightness_max = brightness_max, brightness_min

                    # Фильтруем по яркости в Python (объём товаров небольшой)
                    filtered_ids = []
                    for product in queryset:
                        if not product.color_rgb:
                            continue
                        try:
                            rgb_parts = [
                                max(0, min(255, int(p.strip())))
                                for p in product.color_rgb.split(',')
                            ]
                            if len(rgb_parts) != 3:
                                continue
                            brightness = round(sum(rgb_parts) / 3)
                            if brightness_min <= brightness <= brightness_max:
                                filtered_ids.append(product.id)
                        except (ValueError, TypeError):
                            continue

                    if filtered_ids:
                        queryset = queryset.filter(id__in=filtered_ids)
                    else:
                        queryset = queryset.none()
                except (ValueError, TypeError):
                    # При ошибке парсинга — игнорируем диапазон и не фильтруем
                    pass
            else:
                # Старый формат "r,g,b" — оставляем как есть для обратной совместимости
                queryset = queryset.filter(color_rgb__icontains=value)

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


    search_fields = ["title", "description", "article", "material", "style", "color", "brand"]

    ordering_fields = ["price", "title"]
    ordering = ["price"]

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def filter_ranges(self, request):
        """
        Лёгкий endpoint для диапазонов фильтров — без загрузки полных товаров.
        Возвращает min/max и списки уникальных значений.
        """
        qs = Product.objects.filter(is_active=True).aggregate(
            price_min=models.Min("price"),
            price_max=models.Max("price"),
            width_min=models.Min("width"),
            width_max=models.Max("width"),
            depth_min=models.Min("depth"),
            depth_max=models.Max("depth"),
        )
        prices = Product.objects.filter(is_active=True, price__gt=0).values_list("price", flat=True)
        widths = Product.objects.filter(is_active=True, width__gt=0).values_list("width", flat=True).distinct()
        depths = Product.objects.filter(is_active=True, depth__gt=0).values_list("depth", flat=True).distinct()
        materials = set()
        styles = set()
        colors = set()
        brands = set()
        for p in Product.objects.filter(is_active=True).values_list("material", "style", "color", "brand").iterator(chunk_size=500):
            for val, s in zip(p, (materials, styles, colors, brands)):
                if val:
                    for part in str(val).split(","):
                        s.add(part.strip())
        return Response({
            "price": {"min": float(qs["price_min"] or 0), "max": float(qs["price_max"] or 100000)},
            "width": {"min": float(qs["width_min"] or 0), "max": float(qs["width_max"] or 500)},
            "depth": {"min": float(qs["depth_min"] or 0), "max": float(qs["depth_max"] or 500)},
            "materials": sorted(materials),
            "styles": sorted(styles),
            "colors": sorted(colors),
            "brands": sorted(brands),
        })


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации

    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context