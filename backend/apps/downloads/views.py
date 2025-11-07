from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from apps.catalog.models import Product
from .models import Download
from .serializers import DownloadSerializer

# Список всех доступных загрузок пользователя
class DownloadListView(generics.ListAPIView):
    serializer_class = DownloadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Download.objects.filter(user=self.request.user).order_by('-created_at')
    
    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


# Удаление записи из истории загрузок
class DownloadDeleteView(generics.DestroyAPIView):
    serializer_class = DownloadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Download.objects.filter(user=self.request.user)

# Endpoint для получения ссылки на скачивание
class PresignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')
        format = request.data.get('format', '')
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Пока возвращаем URL изображения товара для скачивания
        if product.image and hasattr(product.image, 'url'):
            # Формируем полный URL для изображения
            image_url = request.build_absolute_uri(product.image.url)
            
            # Создаем запись в истории загрузок
            # Используем get_or_create, чтобы не создавать дубликаты
            download, created = Download.objects.get_or_create(
                user=request.user,
                product=product
            )
            # Если запись уже существует, создаем новую с текущим временем
            if not created:
                # Удаляем старую запись и создаем новую для обновления времени
                download.delete()
                download = Download.objects.create(
                    user=request.user,
                    product=product
                )
            
            return Response({
                "url": image_url,
                "message": "Изображение товара",
                "download_id": download.id
            }, status=status.HTTP_200_OK)
        
        # Если изображение не найдено, возвращаем сообщение
        return Response(
            {
                "url": None,
                "error": "Изображение товара не найдено"
            },
            status=status.HTTP_404_NOT_FOUND
        )
