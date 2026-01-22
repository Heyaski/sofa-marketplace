"""
Webhook для обработки уведомлений от ЮКассы
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import json
from services.yookassa_service import YooKassaService


@api_view(['POST'])
@permission_classes([AllowAny])
def yookassa_webhook(request):
    """
    Webhook для обработки уведомлений от ЮКассы о статусе платежа
    
    ЮКасса будет отправлять POST запросы на этот endpoint при изменении статуса платежа
    """
    try:
        # Получаем данные из запроса
        event = request.data.get('event')
        payment_object = request.data.get('object', {})
        payment_id = payment_object.get('id')
        
        if not payment_id:
            return Response(
                {"error": "payment_id отсутствует"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Обрабатываем только события успешной оплаты
        if event == 'payment.succeeded':
            yookassa_service = YooKassaService()
            try:
                profile = yookassa_service.process_successful_payment(payment_id)
                return Response({
                    "status": "success",
                    "message": f"Подписка активирована для пользователя {profile.user.username}",
                    "subscription_type": profile.subscription_type,
                }, status=status.HTTP_200_OK)
            except Exception as e:
                # Логируем ошибку, но возвращаем 200, чтобы ЮКасса не повторяла запрос
                print(f"Ошибка при обработке платежа {payment_id}: {str(e)}")
                return Response({
                    "status": "error",
                    "message": str(e)
                }, status=status.HTTP_200_OK)
        
        # Для других событий просто подтверждаем получение
        return Response({
            "status": "received",
            "event": event
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        # Логируем ошибку, но возвращаем 200, чтобы ЮКасса не повторяла запрос
        print(f"Ошибка при обработке webhook от ЮКассы: {str(e)}")
        return Response({
            "status": "error",
            "message": str(e)
        }, status=status.HTTP_200_OK)

