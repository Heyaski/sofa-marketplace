from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.core.files.base import ContentFile

from .models import Basket, BasketItem, BasketEditRequest, CommercialProposalRequest
from .serializers import (
    BasketSerializer, BasketItemSerializer, BasketEditRequestSerializer,
    CommercialProposalRequestSerializer
)
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
        
        # Объединяем и убираем дубликаты; prefetch для изображений товаров в корзине
        return (user_baskets | shared_baskets).distinct().prefetch_related(
            'items__product', 'items__product__images'
        )
    
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
    
    def _can_edit_basket(self, basket):
        """Проверяет, может ли пользователь редактировать корзину"""
        # Владелец всегда может редактировать
        if basket.user == self.request.user:
            return True
        
        # Проверяем, есть ли одобренный запрос на редактирование
        return BasketEditRequest.objects.filter(
            basket=basket,
            requester=self.request.user,
            status='approved'
        ).exists()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    def update(self, request, *args, **kwargs):
        """Обновление корзины - для владельца или пользователя с одобренным запросом"""
        basket = self.get_object()
        if not self._can_edit_basket(basket):
            return Response(
                {"error": "У вас нет прав на редактирование этой корзины"},
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
        # Проверяем права на редактирование
        if not self._can_edit_basket(basket):
            return Response(
                {"error": "У вас нет прав на редактирование этой корзины"},
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
        # Проверяем права на редактирование
        if not self._can_edit_basket(basket):
            return Response(
                {"error": "У вас нет прав на редактирование этой корзины"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            item = BasketItem.objects.get(basket=basket, product_id=product_id)
            item.delete()
            return Response({"message": "Товар удалён"})
        except BasketItem.DoesNotExist:
            return Response({"error": "Товар не найден в корзине"}, status=404)
    
    # Генерация публичной ссылки
    @action(detail=True, methods=["post"])
    def generate_share_link(self, request, pk=None):
        """Генерирует публичную ссылку на корзину"""
        basket = self.get_object()
        if basket.user != request.user:
            return Response(
                {"error": "Только владелец может создать публичную ссылку"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        share_token = basket.generate_share_token()
        share_url = basket.get_share_url(request)
        # Убираем поддомен api. из URL если он есть
        if '://api.' in share_url:
            share_url = share_url.replace('://api.', '://')
        # Убираем /api/ из URL если он есть
        if '/api/' in share_url:
            share_url = share_url.replace('/api/', '/')
        return Response({"share_token": share_token, "share_url": share_url})
    
    @action(detail=True, methods=["get"])
    def edit_requests(self, request, pk=None):
        """Получить запросы на редактирование для этой корзины"""
        basket = self.get_object()
        # Только владелец может видеть запросы
        if basket.user != request.user:
            return Response(
                {"error": "Только владелец может просматривать запросы на редактирование"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from .serializers import BasketEditRequestSerializer
        requests = BasketEditRequest.objects.filter(basket=basket, status='pending')
        serializer = BasketEditRequestSerializer(requests, many=True, context={'request': request})
        return Response(serializer.data)
    
    # Генерация коммерческого предложения
    @action(detail=True, methods=["post"])
    def generate_commercial_proposal(self, request, pk=None):
        """Генерирует коммерческое предложение (КП) и отправляет по email или Telegram"""
        basket = self.get_object()
        
        # Проверяем, что в корзине есть товары
        if not basket.items.exists():
            return Response(
                {"error": "Корзина пуста. Добавьте товары для формирования КП."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CommercialProposalRequestSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Получаем данные из запроса
        data = serializer.validated_data
        basket_id = data.pop('basket_id', basket.id)
        
        # Создаем запрос КП
        proposal = CommercialProposalRequest.objects.create(
            basket=basket,
            user=request.user,
            client_name=data.get('client_name', ''),
            company_name=data.get('company_name', ''),
            email=data.get('email', ''),
            telegram=data.get('telegram', ''),
            delivery_method=data.get('delivery_method', 'email'),
            project_name=data.get('project_name', basket.name),
        )
        
        try:
            # Генерируем PDF и DOCX
            from services.commercial_proposal import (
                generate_commercial_proposal_pdf,
                generate_commercial_proposal_docx,
                send_proposal_email,
                send_proposal_telegram,
            )
            
            pdf_bytes = generate_commercial_proposal_pdf(proposal)
            docx_bytes = generate_commercial_proposal_docx(proposal)
            
            # Сохраняем файлы
            filename_pdf = f"cp_{proposal.id}_{basket.id}.pdf"
            filename_docx = f"cp_{proposal.id}_{basket.id}.docx"
            proposal.pdf_file.save(filename_pdf, ContentFile(pdf_bytes), save=False)
            proposal.docx_file.save(filename_docx, ContentFile(docx_bytes), save=False)
            proposal.status = 'generated'
            proposal.save()
            
            # Отправляем по выбранному каналу
            try:
                if proposal.delivery_method == 'email' and proposal.email:
                    send_proposal_email(proposal, pdf_bytes)
                    proposal.status = 'sent'
                    proposal.save()
                elif proposal.delivery_method == 'telegram' and proposal.telegram:
                    send_proposal_telegram(proposal, pdf_bytes)
                    proposal.status = 'sent'
                    proposal.save()
            except Exception as send_error:
                # КП сгенерировано, но не отправлено
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Ошибка отправки КП #{proposal.id}: {send_error}")
                # Не меняем статус - оставляем 'generated'
            
            # Обновляем данные пользователя (собираем контактную информацию)
            user = request.user
            if data.get('email') and not user.email:
                user.email = data['email']
                user.save(update_fields=['email'])
            
            result_serializer = CommercialProposalRequestSerializer(proposal, context={'request': request})
            return Response(result_serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            proposal.status = 'failed'
            proposal.save()
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Ошибка генерации КП #{proposal.id}: {e}", exc_info=True)
            return Response(
                {"error": f"Ошибка генерации КП: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # Получение корзины по публичной ссылке (без авторизации)
    @action(detail=False, methods=["get"], url_path="share/(?P<share_token>[^/.]+)", permission_classes=[AllowAny])
    def get_by_share_token(self, request, share_token=None):
        """Получить корзину по публичному токену (без авторизации)"""
        try:
            basket = Basket.objects.get(share_token=share_token)
            serializer = BasketSerializer(basket, context={'request': request})
            return Response(serializer.data)
        except Basket.DoesNotExist:
            return Response(
                {"error": "Корзина не найдена"},
                status=status.HTTP_404_NOT_FOUND
            )


class BasketItemViewSet(viewsets.ModelViewSet):
    serializer_class = BasketItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BasketItem.objects.filter(basket__user=self.request.user)

    def perform_create(self, serializer):
        basket, created = Basket.objects.get_or_create(user=self.request.user)
        serializer.save(basket=basket)


class BasketEditRequestViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с запросами на редактирование корзины"""
    serializer_class = BasketEditRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        """Получить запросы, где пользователь является запрашивающим или владельцем корзины"""
        user = self.request.user
        return BasketEditRequest.objects.filter(
            Q(requester=user) | Q(basket__user=user)
        ).distinct()
    
    def perform_create(self, serializer):
        """Создать запрос на редактирование"""
        basket_id = serializer.validated_data.get('basket_id')
        try:
            basket = Basket.objects.get(id=basket_id)
        except Basket.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Корзина не найдена")
        
        # Нельзя запросить редактирование своей корзины
        if basket.user == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Вы не можете запросить редактирование своей корзины")
        
        # Проверяем, нет ли уже активного запроса
        existing_request = BasketEditRequest.objects.filter(
            basket=basket,
            requester=self.request.user,
            status='pending'
        ).first()
        
        if existing_request:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("У вас уже есть активный запрос на редактирование этой корзины")
        
        serializer.save(requester=self.request.user, basket=basket)
    
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Одобрить запрос на редактирование (только владелец корзины)"""
        edit_request = self.get_object()
        
        if edit_request.basket.user != request.user:
            return Response(
                {"error": "Только владелец корзины может одобрить запрос"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if edit_request.status != 'pending':
            return Response(
                {"error": "Запрос уже обработан"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        edit_request.status = 'approved'
        edit_request.save()
        
        serializer = self.get_serializer(edit_request)
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Отклонить запрос на редактирование (только владелец корзины)"""
        edit_request = self.get_object()
        
        if edit_request.basket.user != request.user:
            return Response(
                {"error": "Только владелец корзины может отклонить запрос"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if edit_request.status != 'pending':
            return Response(
                {"error": "Запрос уже обработан"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        edit_request.status = 'rejected'
        edit_request.save()
        
        serializer = self.get_serializer(edit_request)
        return Response(serializer.data)
