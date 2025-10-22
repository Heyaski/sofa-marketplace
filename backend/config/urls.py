from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.users.views import CustomTokenObtainPairView

# подключаем наш сервис оплаты
from services.payment_views import pay_order

urlpatterns = [
    path("admin/", admin.site.urls),

    # JWT
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # наши приложения
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.baskets.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.subscriptions.urls")),
    path("api/", include("apps.downloads.urls")),
    path("api/users/", include("apps.users.urls")),

    # оплата
    path("api/orders/<int:order_id>/pay/", pay_order, name="pay_order"),
]
