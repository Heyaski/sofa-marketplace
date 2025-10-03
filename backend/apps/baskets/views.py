from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Basket, BasketItem
from .serializers import BasketSerializer, BasketItemSerializer
from apps.catalog.models import Product


class BasketViewSet(viewsets.ModelViewSet):
    serializer_class = BasketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Basket.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    #Подсчёт общей суммы корзины
    @action(detail=True, methods=["get"])
    def total(self, request, pk=None):
        basket = self.get_object()
        total_price = sum(item.product.price * item.quantity for item in basket.items.all())
        return Response({"basket_id": basket.id, "total_price": total_price})

    #Добавление товара
    @action(detail=True, methods=["post"])
    def add_product(self, request, pk=None):
        basket = self.get_object()
        product_id = request.data.get("product_id")
        quantity = int(request.data.get("quantity", 1))

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "Товар не найден"}, status=404)

        item, created = BasketItem.objects.get_or_create(basket=basket, product=product)
        if not created:
            item.quantity += quantity
        else:
            item.quantity = quantity
        item.save()

        return Response(BasketSerializer(basket).data)

    #Удаление товара
    @action(detail=True, methods=["delete"], url_path="remove-product/(?P<product_id>[^/.]+)")
    def remove_product(self, request, pk=None, product_id=None):
        basket = self.get_object()
        try:
            item = BasketItem.objects.get(basket=basket, product_id=product_id)
            item.delete()
            return Response({"message": "Товар удалён"})
        except BasketItem.DoesNotExist:
            return Response({"error": "Товар не найден в корзине"}, status=404)


class BasketItemViewSet(viewsets.ModelViewSet):
    serializer_class = BasketItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BasketItem.objects.filter(basket__user=self.request.user)

    def perform_create(self, serializer):
        basket, created = Basket.objects.get_or_create(user=self.request.user)
        serializer.save(basket=basket)
