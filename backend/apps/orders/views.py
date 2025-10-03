from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order, OrderItem
from apps.baskets.models import Basket
from .serializers import OrderSerializer
from apps.downloads.models import Download

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        basket = Basket.objects.filter(user=self.request.user).first()
        if not basket or basket.items.count() == 0:
            raise ValueError("Корзина пуста")

        order = serializer.save(user=self.request.user)

        total = 0
        for item in basket.items.all():
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                price=item.product.price,
            )
            total += item.quantity * item.product.price

        order.total_price = total
        order.save()

        # после оформления можно очистить корзину
        basket.items.all().delete()

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status == "pending":
            order.status = "canceled"
            order.save()
            return Response({"status": "Заказ отменён"})
        return Response(
            {"error": "Нельзя отменить оплаченный или завершённый заказ"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    #Оплата заказа
    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        order = self.get_object()

        if order.status == "paid":
            return Response(
                {"detail": "Заказ уже оплачен"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.status == "canceled":
            return Response(
                {"detail": "Отменённый заказ оплатить нельзя"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        #пока делаем фейковую оплату
        order.status = "paid"
        order.save()

        #создаём загрузки для всех товаров заказа
        for item in order.items.all():
            Download.objects.get_or_create(
                user=request.user,
                product=item.product
            )

        return Response(
            {"detail": f"Заказ #{order.id} успешно оплачен"},
            status=status.HTTP_200_OK,
        )
