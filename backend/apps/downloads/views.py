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

    def _as_absolute(self, request, url: str | None):
        if not url:
            return None
        if url.startswith('http://') or url.startswith('https://'):
            return url
        return request.build_absolute_uri(url)

    def _resolve_file_url(self, request, product, fmt):
        """Возвращает URL файла нужного формата или None."""
        if fmt in ('.rfa', '.ifc'):
            # 1) Приоритет: legacy поле модели у продукта
            if product.model_rfa:
                return self._as_absolute(request, product.model_rfa)
            # 2) Fallback: файл в FileAsset, привязанный к товару
            for asset in product.get_3d_model_assets():
                name = (getattr(asset.file, 'name', '') or '').lower()
                if name.endswith(('.rfa', '.ifc')):
                    file_url = getattr(asset.file, 'url', None)
                    if file_url:
                        return self._as_absolute(request, file_url)
        if fmt == '.glb':
            if product.model_glb:
                return self._as_absolute(request, product.model_glb)
            for asset in product.get_3d_model_assets():
                name = (getattr(asset.file, 'name', '') or '').lower()
                if name.endswith(('.glb', '.gltf', '.usdz')):
                    file_url = getattr(asset.file, 'url', None)
                    if file_url:
                        return self._as_absolute(request, file_url)
        if product.image and hasattr(product.image, 'url'):
            return request.build_absolute_uri(product.image.url)
        return None

    def post(self, request):
        try:
            product_id = request.data.get('product_id')
            fmt = request.data.get('format', '')

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

            file_url = self._resolve_file_url(request, product, fmt)

            if not file_url:
                return Response(
                    {"url": None, "error": "Файл не найден для этого товара"},
                    status=status.HTTP_404_NOT_FOUND
                )

            existing_download = Download.objects.filter(user=request.user, product=product).first()
            if existing_download:
                return Response({
                    "url": file_url,
                    "download_id": existing_download.id,
                    "warning": "Этот товар уже был скачан ранее"
                }, status=status.HTTP_200_OK)

            from apps.users.models import UserProfile

            try:
                user_profile = request.user.profile
            except UserProfile.DoesNotExist:
                user_profile = UserProfile.objects.create(
                    user=request.user,
                    subscription_type='trial'
                )

            downloads_count = Download.objects.filter(
                user=request.user
            ).values('product').distinct().count()

            if not user_profile.can_download(downloads_count):
                limit = user_profile.get_download_limit()
                subscription_name = dict(UserProfile.SUBSCRIPTION_CHOICES).get(
                    user_profile.subscription_type, 'Пробная'
                )
                return Response(
                    {
                        "error": f"Достигнут лимит скачиваний для подписки '{subscription_name}'. "
                                 f"Доступно скачиваний: {limit}. "
                                 f"Для увеличения лимита обновите подписку."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

            download = Download.objects.create(
                user=request.user,
                product=product
            )

            remaining_downloads = None
            limit = user_profile.get_download_limit()
            if limit is not None:
                new_count = Download.objects.filter(
                    user=request.user
                ).values('product').distinct().count()
                remaining_downloads = max(0, limit - new_count)

            return Response({
                "url": file_url,
                "download_id": download.id,
                "remaining_downloads": remaining_downloads
            }, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            print(f"Error in PresignView: {str(e)}")
            print(traceback.format_exc())

            return Response(
                {"error": f"Внутренняя ошибка сервера: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
