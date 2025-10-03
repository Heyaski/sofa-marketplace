from rest_framework.routers import DefaultRouter
from .views import BasketViewSet, BasketItemViewSet

router = DefaultRouter()
router.register(r"baskets", BasketViewSet, basename="basket")
router.register(r"basket-items", BasketItemViewSet, basename="basketitem")

urlpatterns = router.urls
