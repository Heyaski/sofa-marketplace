"""
Middleware для долгого кэширования медиа-файлов (3D модели, изображения).
При обновлении страницы браузер использует кэш, не перекачивает.
"""
from django.utils.deprecation import MiddlewareMixin


class MediaCacheMiddleware(MiddlewareMixin):
    """
    Добавляет Cache-Control для /media/ — 1 год.
    Работает только когда media раздаётся через Django (DEBUG, без S3).
    """

    def process_response(self, request, response):
        path = getattr(request, "path", "") or ""
        if path.startswith("/media/") and response.status_code == 200:
            response["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
