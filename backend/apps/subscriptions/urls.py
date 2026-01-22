from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .views import PlanViewSet, SubscriptionViewSet
from .webhook_views import yookassa_webhook

router = DefaultRouter()
router.register(r"plans", PlanViewSet, basename='plan')
router.register(r"subscriptions", SubscriptionViewSet, basename='subscription')

# Отдельные view-классы для кастомных actions
class CreatePaymentView(APIView):
    """View для создания платежа"""
    def post(self, request):
        viewset = SubscriptionViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        viewset.action = 'create_payment'
        return viewset.create_payment(request)

class CheckPaymentStatusView(APIView):
    """View для проверки статуса платежа"""
    def post(self, request):
        viewset = SubscriptionViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        viewset.action = 'check_payment_status'
        return viewset.check_payment_status(request)

urlpatterns = [
    # Кастомные actions для подписок (должны быть ДО роутера)
    path("create_payment/", CreatePaymentView.as_view(), name='subscription-create-payment'),
    path("check_payment_status/", CheckPaymentStatusView.as_view(), name='subscription-check-payment-status'),
    path("yookassa/webhook/", yookassa_webhook, name="yookassa_webhook"),
    # Роутер должен быть последним
    path("", include(router.urls)),
]
