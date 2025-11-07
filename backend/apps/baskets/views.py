from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from .models import Basket, BasketItem
from .serializers import BasketSerializer, BasketItemSerializer
from apps.catalog.models import Product
from apps.chats.models import MessageBasket


class BasketViewSet(viewsets.ModelViewSet):
    serializer_class = BasketSerializer
    permission_classes = [IsAuthenticated]
    
    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        # Возвращаем корзины пользователя и корзины, которые были отправлены ему в сообщениях
        user_baskets = Basket.objects.filter(user=self.request.user)
        
        # Находим корзины, которые были отправлены текущему пользователю в сообщениях
        shared_baskets = Basket.objects.filter(
            messagebasket__message__chat__participant1=self.request.user
        ) | Basket.objects.filter(
            messagebasket__message__chat__participant2=self.request.user
        )
        
        # Объединяем и убираем дубликаты
        return (user_baskets | shared_baskets).distinct()
    
    def get_object(self):
        """Переопределяем get_object для проверки доступа"""
        obj = super().get_object()
        
        # Если корзина принадлежит пользователю - доступ разрешен
        if obj.user == self.request.user:
            return obj
        
        # Если корзина была отправлена пользователю в сообщении - доступ разрешен только для чтения
        # Проверяем, есть ли сообщения с этой корзиной, где пользователь является участником чата
        has_access = MessageBasket.objects.filter(
            basket=obj,
            message__chat__participant1=self.request.user
        ).exists() or MessageBasket.objects.filter(
            basket=obj,
            message__chat__participant2=self.request.user
        ).exists()
        
        if not has_access:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("У вас нет доступа к этой корзине")
        
        return obj

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    def update(self, request, *args, **kwargs):
        """Обновление корзины - только для владельца"""
        basket = self.get_object()
        if basket.user != request.user:
            return Response(
                {"error": "Вы можете редактировать только свои корзины"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Удаление корзины - только для владельца"""
        basket = self.get_object()
        if basket.user != request.user:
            return Response(
                {"error": "Вы можете удалять только свои корзины"},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

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
        # Проверяем, что пользователь является владельцем корзины
        if basket.user != request.user:
            return Response(
                {"error": "Вы можете добавлять товары только в свои корзины"},
                status=status.HTTP_403_FORBIDDEN
            )
        
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

        return Response(BasketSerializer(basket, context={'request': request}).data)

    #Удаление товара
    @action(detail=True, methods=["delete"], url_path="remove-product/(?P<product_id>[^/.]+)")
    def remove_product(self, request, pk=None, product_id=None):
        basket = self.get_object()
        # Проверяем, что пользователь является владельцем корзины
        if basket.user != request.user:
            return Response(
                {"error": "Вы можете удалять товары только из своих корзин"},
                status=status.HTTP_403_FORBIDDEN
            )
        
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
