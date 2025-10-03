from apps.orders.models import Order
from apps.downloads.models import Download

def process_payment(order_id: int, user):
    """
    Фейковая обработка оплаты заказа.
    Меняет статус заказа на 'paid' и выдает пользователю доступ к файлам.
    """
    try:
        order = Order.objects.get(id=order_id, user=user)
    except Order.DoesNotExist:
        raise ValueError("Заказ не найден")

    if order.status == "paid":
        return {"message": "Заказ уже оплачен"}

    # Помечаем заказ как оплаченный
    order.status = "paid"
    order.save()

    # Выдаем доступ к файлам (например, на основе продуктов заказа)
    for item in order.items.all():
        Download.objects.create(
            user=user,
            file_name=f"Файл для {item.product.title}",
            file_url=f"http://example.com/downloads/{item.product.id}"
        )

    return {"message": f"Заказ #{order.id} оплачен", "status": order.status}
