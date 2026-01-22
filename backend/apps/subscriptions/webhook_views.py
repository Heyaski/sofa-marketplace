"""
Webhook для обработки уведомлений от ЮКассы
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import json
import logging
from services.yookassa_service import YooKassaService

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def yookassa_webhook(request):
    """
    Webhook для обработки уведомлений от ЮКассы о статусе платежа
    
    ЮКасса будет отправлять POST запросы на этот endpoint при изменении статуса платежа
    """
    try:
        logger.info(f"Получен webhook от ЮКассы. Данные: {request.data}")
        
        # Получаем данные из запроса
        event = request.data.get('event')
        payment_object = request.data.get('object', {})
        payment_id = payment_object.get('id')
        
        logger.info(f"Webhook event: {event}, payment_id: {payment_id}")
        
        if not payment_id:
            logger.error("payment_id отсутствует в webhook запросе")
            return Response(
                {"error": "payment_id отсутствует"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Обрабатываем только события успешной оплаты
        if event == 'payment.succeeded':
            logger.info(f"Обработка успешного платежа: {payment_id}")
            yookassa_service = YooKassaService()
            try:
                profile = yookassa_service.process_successful_payment(payment_id)
                logger.info(f"Подписка успешно активирована для пользователя {profile.user.username}, тип: {profile.subscription_type}")
                return Response({
                    "status": "success",
                    "message": f"Подписка активирована для пользователя {profile.user.username}",
                    "subscription_type": profile.subscription_type,
                }, status=status.HTTP_200_OK)
            except Exception as e:
                # Логируем ошибку, но возвращаем 200, чтобы ЮКасса не повторяла запрос
                logger.error(f"Ошибка при обработке платежа {payment_id}: {str(e)}", exc_info=True)
                return Response({
                    "status": "error",
                    "message": str(e)
                }, status=status.HTTP_200_OK)
        
        # Для других событий просто подтверждаем получение
        logger.info(f"Получено событие {event}, но оно не обрабатывается")
        return Response({
            "status": "received",
            "event": event
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        # Логируем ошибку, но возвращаем 200, чтобы ЮКасса не повторяла запрос
        logger.error(f"Ошибка при обработке webhook от ЮКассы: {str(e)}", exc_info=True)
        return Response({
            "status": "error",
            "message": str(e)
        }, status=status.HTTP_200_OK)

