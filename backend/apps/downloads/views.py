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
        try:
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
            
            # Сначала проверяем, не скачивал ли пользователь этот товар ранее
            existing_download = Download.objects.filter(user=request.user, product=product).first()
            if existing_download:
                # Если товар уже скачан, просто возвращаем ссылку без проверки лимита
                if product.image and hasattr(product.image, 'url'):
                    image_url = request.build_absolute_uri(product.image.url)
                    return Response({
                        "url": image_url,
                        "message": "Изображение товара",
                        "download_id": existing_download.id,
                        "warning": "Этот товар уже был скачан ранее"
                    }, status=status.HTTP_200_OK)
            
            # Если товар еще не был скачан, проверяем лимит скачиваний по подписке
            from apps.users.models import UserProfile
            
            try:
                user_profile = request.user.profile
            except UserProfile.DoesNotExist:
                # Если профиля нет, создаем его с пробной подпиской
                user_profile = UserProfile.objects.create(
                    user=request.user,
                    subscription_type='trial'
                )
            
            # Подсчитываем количество уникальных скачанных товаров (исключая текущий, так как он еще не скачан)
            downloads_count = Download.objects.filter(user=request.user).values('product').distinct().count()
            
            # Проверяем, может ли пользователь скачать еще уникальных товаров
            if not user_profile.can_download(downloads_count):
                limit = user_profile.get_download_limit()
                subscription_name = dict(UserProfile.SUBSCRIPTION_CHOICES).get(user_profile.subscription_type, 'Пробная')
                return Response(
                    {
                        "error": f"Достигнут лимит скачиваний для подписки '{subscription_name}'. "
                                 f"Доступно скачиваний: {limit}. "
                                 f"Для увеличения лимита обновите подписку."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Пока возвращаем URL изображения товара для скачивания
            if product.image and hasattr(product.image, 'url'):
                # Формируем полный URL для изображения
                image_url = request.build_absolute_uri(product.image.url)
                
                # Создаем запись в истории загрузок
                download = Download.objects.create(
                    user=request.user,
                    product=product
                )
                
                # Получаем оставшееся количество скачиваний
                remaining_downloads = None
                limit = user_profile.get_download_limit()
                if limit is not None:
                    new_count = Download.objects.filter(user=request.user).values('product').distinct().count()
                    remaining_downloads = max(0, limit - new_count)
                
                return Response({
                    "url": image_url,
                    "message": "Изображение товара",
                    "download_id": download.id,
                    "remaining_downloads": remaining_downloads  # None для премиум, число для других
                }, status=status.HTTP_200_OK)
            
            # Если изображение не найдено, возвращаем сообщение
            return Response(
                {
                    "url": None,
                    "error": "Изображение товара не найдено"
                },
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # Логируем ошибку для отладки
            import traceback
            print(f"Error in PresignView: {str(e)}")
            print(traceback.format_exc())
            
            # Возвращаем JSON-ответ с ошибкой
            return Response(
                {
                    "error": f"Внутренняя ошибка сервера: {str(e)}"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
