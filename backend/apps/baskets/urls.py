from rest_framework.routers import DefaultRouter
from .views import BasketViewSet, BasketItemViewSet, BasketEditRequestViewSet

router = DefaultRouter()
router.register(r"baskets", BasketViewSet, basename="basket")
router.register(r"basket-items", BasketItemViewSet, basename="basketitem")
router.register(r"basket-edit-requests", BasketEditRequestViewSet, basename="basketeditrequest")

urlpatterns = router.urls
