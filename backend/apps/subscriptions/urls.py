from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanViewSet, SubscriptionViewSet

router = DefaultRouter()
router.register(r"plans", PlanViewSet)
router.register(r"subscriptions", SubscriptionViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
