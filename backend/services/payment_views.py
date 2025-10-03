from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from services.payment_service import process_payment

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pay_order(request, order_id):
    user = request.user
    try:
        result = process_payment(order_id, user)
        return Response(result)
    except ValueError as e:
        return Response({"error": str(e)}, status=404)
