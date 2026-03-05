from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    BasketViewSet, BasketItemViewSet, BasketEditRequestViewSet,
    download_proposal_pdf, download_proposal_docx,
)

router = DefaultRouter()
router.register(r"baskets", BasketViewSet, basename="basket")
router.register(r"basket-items", BasketItemViewSet, basename="basketitem")
router.register(r"basket-edit-requests", BasketEditRequestViewSet, basename="basketeditrequest")

urlpatterns = [
    path("baskets/commercial-proposals/<int:proposal_id>/download-pdf/", download_proposal_pdf),
    path("baskets/commercial-proposals/<int:proposal_id>/download-docx/", download_proposal_docx),
] + router.urls
