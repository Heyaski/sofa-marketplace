from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.users.views import CustomTokenObtainPairView
from apps.plugin.views import PluginLegacyLicenseView

# подключаем наш сервис оплаты
from services.payment_views import pay_order

# 👇 добавляем для медиа
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    # Legacy alias for ready-made plugin (when base URL is set to domain root)
    path("license.php", PluginLegacyLicenseView.as_view(), name="plugin-license-legacy-root"),

    # JWT
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # наши приложения
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.baskets.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/subscriptions/", include("apps.subscriptions.urls")),
    path("api/", include("apps.downloads.urls")),
    path("api/", include("apps.plugin.urls")),
    path("api/", include("apps.chats.urls")),
    path("api/", include("apps.pages.urls")),
    path("api/users/", include("apps.users.urls")),

    # оплата
    path("api/orders/<int:order_id>/pay/", pay_order, name="pay_order"),
]

# 👇 эта часть обязательна для отображения изображений при DEBUG=True
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
