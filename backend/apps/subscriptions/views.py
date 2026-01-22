from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
import logging
import traceback
from .models import Plan, Subscription
from .serializers import PlanSerializer, SubscriptionSerializer
from services.yookassa_service import YooKassaService

logger = logging.getLogger(__name__)


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # юзер видит только свои подписки
        return Subscription.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def create_payment(self, request):
        """
        Создает платеж для подписки через ЮКассу
        """
        try:
            logger.info(f"Создание платежа. Пользователь: {request.user.username}, данные: {request.data}")
            
            subscription_type = request.data.get('subscription_type')
            
            if not subscription_type:
                logger.warning(f"subscription_type не указан в запросе. Данные: {request.data}")
                return Response(
                    {"error": "subscription_type обязателен"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if subscription_type not in ['basic', 'premium']:
                logger.warning(f"Неверный тип подписки: {subscription_type}")
                return Response(
                    {"error": f"Неверный тип подписки: {subscription_type}. Доступны: basic, premium"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Получаем URL для возврата после оплаты
            return_url = request.data.get('return_url')
            if not return_url:
                # Если не указан, используем URL из настроек или дефолтный
                return_url = getattr(
                    settings,
                    'YOOKASSA_RETURN_URL',
                    f"{request.scheme}://{request.get_host()}/profile/subscription?payment_success=true"
                )
            
            logger.info(f"Создание платежа для типа подписки: {subscription_type}, return_url: {return_url}")
            
            yookassa_service = YooKassaService()
            payment_data = yookassa_service.create_subscription_payment(
                user=request.user,
                subscription_type=subscription_type,
                return_url=return_url
            )
            
            logger.info(f"Платеж успешно создан: {payment_data.get('payment_id')}")
            
            return Response({
                "payment_id": payment_data["payment_id"],
                "confirmation_url": payment_data["confirmation_url"],
                "amount": payment_data["amount"],
                "currency": payment_data["currency"],
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            logger.error(f"ValueError при создании платежа: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"Ошибка при создании платежа: {str(e)}\n{error_traceback}")
            return Response(
                {"error": f"Ошибка при создании платежа: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def check_payment_status(self, request):
        """
        Проверяет статус платежа
        """
        payment_id = request.data.get('payment_id')
        
        if not payment_id:
            return Response(
                {"error": "payment_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            yookassa_service = YooKassaService()
            payment_status = yookassa_service.get_payment_status(payment_id)
            
            # Если платеж успешен, активируем подписку
            if payment_status["status"] == "succeeded" and payment_status["paid"]:
                try:
                    profile = yookassa_service.process_successful_payment(payment_id)
                    return Response({
                        "status": "succeeded",
                        "paid": True,
                        "subscription_activated": True,
                        "subscription_type": profile.subscription_type,
                        "subscription_end_date": profile.subscription_end_date.isoformat() if profile.subscription_end_date else None,
                    }, status=status.HTTP_200_OK)
                except Exception as e:
                    return Response({
                        "status": "succeeded",
                        "paid": True,
                        "subscription_activated": False,
                        "error": f"Ошибка при активации подписки: {str(e)}"
                    }, status=status.HTTP_200_OK)
            
            return Response({
                "status": payment_status["status"],
                "paid": payment_status["paid"],
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Ошибка при проверке статуса платежа: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
