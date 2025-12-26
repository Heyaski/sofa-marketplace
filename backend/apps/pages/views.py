from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from .models import StaticPage
from .serializers import StaticPageSerializer


@method_decorator(never_cache, name='dispatch')
class StaticPageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для получения статических страниц.
    Доступен без авторизации для чтения.
    
    Можно получить страницу:
    - По типу: /api/pages/privacy/ или /api/pages/terms/
    - По slug: через action by-slug
    - Все страницы: /api/pages/
    """
    queryset = StaticPage.objects.filter(is_active=True)
    serializer_class = StaticPageSerializer
    permission_classes = [AllowAny]
    lookup_field = 'page_type'
    lookup_value_regex = '[^/]+'
    
    def retrieve(self, request, *args, **kwargs):
        """Переопределяем retrieve для добавления заголовков против кеширования"""
        response = super().retrieve(request, *args, **kwargs)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    
    def list(self, request, *args, **kwargs):
        """Переопределяем list для добавления заголовков против кеширования"""
        response = super().list(request, *args, **kwargs)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    
    @action(detail=False, methods=['get'])
    def by_slug(self, request):
        """
        Получить страницу по slug
        Пример: /api/pages/by-slug/?slug=politika-konfidentsialnosti
        """
        slug = request.query_params.get('slug')
        if not slug:
            return Response({'detail': 'Параметр slug обязателен'}, status=400)
        page = get_object_or_404(StaticPage, slug=slug, is_active=True)
        serializer = self.get_serializer(page)
        response = Response(serializer.data)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

