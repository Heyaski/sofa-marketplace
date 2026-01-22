from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanViewSet, SubscriptionViewSet
from .webhook_views import yookassa_webhook

router = DefaultRouter()
router.register(r"plans", PlanViewSet)
router.register(r"subscriptions", SubscriptionViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("yookassa/webhook/", yookassa_webhook, name="yookassa_webhook"),
]
