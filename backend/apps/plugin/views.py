"""
API для плагина (Revit и др.).
Авторизация: заголовок X-License-Hash (хеш ключа лицензии из профиля пользователя).
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.users.models import UserProfile
from apps.catalog.models import Product
from apps.downloads.models import Download

from .utils import resolve_product_file_url

logger = logging.getLogger(__name__)

LICENSE_HEADER = 'X-License-Hash'


def get_profile_from_request(request):
    """Возвращает UserProfile по заголовку X-License-Hash или None."""
    license_hash = request.headers.get(LICENSE_HEADER) or request.META.get(f'HTTP_{LICENSE_HEADER.upper().replace("-", "_")}')
    if not license_hash or not license_hash.strip():
        return None
    license_hash = license_hash.strip()
    try:
        return UserProfile.objects.get(license_key_hash=license_hash)
    except UserProfile.DoesNotExist:
        return None


def license_required(view_method):
    """Декоратор: проверяет лицензию, добавляет profile в request."""
    def wrapper(self, request, *args, **kwargs):
        profile = get_profile_from_request(request)
        if not profile:
            return Response(
                {"error": "Неверный или отсутствующий ключ лицензии. Добавьте заголовок X-License-Hash."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not profile.is_subscription_active():
            return Response(
                {"error": "Подписка не активна или истекла. Обновите подписку на сайте."},
                status=status.HTTP_403_FORBIDDEN
            )
        request.plugin_profile = profile
        return view_method(self, request, *args, **kwargs)
    return wrapper


class PluginActivateView(APIView):
    """
    POST /api/plugin/activate/
    Header: X-License-Hash
    Проверка лицензии. Возвращает valid, subscription_type, download_limit.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        profile = get_profile_from_request(request)
        if not profile:
            return Response(
                {"valid": False, "error": "Неверный ключ лицензии"},
                status=status.HTTP_200_OK
            )
        if not profile.is_subscription_active():
            return Response(
                {"valid": False, "error": "Подписка не активна или истекла"},
                status=status.HTTP_200_OK
            )
        limit = profile.get_download_limit()
        return Response({
            "valid": True,
            "subscription_type": profile.subscription_type,
            "subscription_type_display": profile.get_subscription_type_display(),
            "download_limit": limit,
            "user_id": profile.user_id,
        }, status=status.HTTP_200_OK)


class PluginProductListView(APIView):
    """
    GET /api/plugin/products/
    Header: X-License-Hash
    Список товаров с GLB/RFA для выбора в плагине.
    """
    permission_classes = []
    authentication_classes = []

    @license_required
    def get(self, request):
        products = Product.objects.filter(is_active=True).order_by('-id')[:500]
        items = []
        for p in products:
            has_glb = bool(p.model_glb or any(
                a.file and a.file.name.lower().endswith(('.glb', '.gltf'))
                for a in p.get_3d_model_assets()
            ))
            has_rfa = bool(p.model_rfa or any(
                a.file and a.file.name.lower().endswith('.rfa')
                for a in p.get_3d_model_assets()
            ))
            if has_glb or has_rfa:
                items.append({
                    "id": p.id,
                    "title": p.title,
                    "article": p.article or "",
                    "has_glb": has_glb,
                    "has_rfa": has_rfa,
                })
        return Response({"products": items}, status=status.HTTP_200_OK)


class PluginDownloadView(APIView):
    """
    POST /api/plugin/download/
    Header: X-License-Hash
    Body: { "product_id": 123, "format": "glb" }  // format: "glb" или "rfa"
    Возвращает url для скачивания. Лимиты как на сайте.
    """
    permission_classes = []
    authentication_classes = []

    @license_required
    def post(self, request):
        profile = request.plugin_profile
        product_id = request.data.get('product_id')
        fmt = request.data.get('format', 'glb')

        if not product_id:
            return Response(
                {"error": "product_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST
            )

        fmt = fmt.lower().strip()
        if fmt not in ('glb', 'rfa'):
            return Response(
                {"error": "format должен быть glb или rfa"},
                status=status.HTTP_400_BAD_REQUEST
            )
        fmt_ext = f'.{fmt}'

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Товар не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        file_url = resolve_product_file_url(product, fmt_ext, request)
        if not file_url:
            return Response(
                {"error": f"Файл {fmt.upper()} не найден для этого товара"},
                status=status.HTTP_404_NOT_FOUND
            )

        user = profile.user
        downloads_count = Download.objects.filter(user=user).values('product').distinct().count()

        if not profile.can_download(downloads_count):
            limit = profile.get_download_limit()
            sub_name = dict(UserProfile.SUBSCRIPTION_CHOICES).get(profile.subscription_type, 'Пробная')
            return Response(
                {
                    "error": f"Достигнут лимит скачиваний для подписки '{sub_name}'. "
                            f"Лимит: {limit}. Обновите подписку на сайте."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        existing = Download.objects.filter(user=user, product=product).first()
        if existing:
            return Response({
                "url": file_url,
                "download_id": existing.id,
                "warning": "Этот товар уже был скачан ранее",
                "suggested_filename": f"{product.article or product.id}_{product.title[:30].replace(' ', '_')}{fmt_ext}",
            }, status=status.HTTP_200_OK)

        download = Download.objects.create(user=user, product=product)
        limit = profile.get_download_limit()
        remaining = None
        if limit is not None:
            new_count = Download.objects.filter(user=user).values('product').distinct().count()
            remaining = max(0, limit - new_count)

        safe_title = (product.article or str(product.id)) + "_" + "".join(
            c for c in product.title[:40] if c.isalnum() or c in ' _-'
        ).strip()
        suggested_filename = f"{safe_title}{fmt_ext}"

        return Response({
            "url": file_url,
            "download_id": download.id,
            "remaining_downloads": remaining,
            "suggested_filename": suggested_filename,
        }, status=status.HTTP_200_OK)
