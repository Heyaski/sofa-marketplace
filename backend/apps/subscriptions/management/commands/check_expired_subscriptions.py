"""
Management команда для проверки истекших подписок
Запускать через cron или celery периодически (например, раз в день)
"""
from django.core.management.base import BaseCommand
from django.utils.timezone import now
from apps.users.models import UserProfile
from services.yookassa_service import YooKassaService


class Command(BaseCommand):
    help = 'Проверяет истекшие подписки и обновляет их статус'

    def handle(self, *args, **options):
        self.stdout.write('Проверка истекших подписок...')
        
        # Находим все активные платные подписки, которые истекли
        expired_profiles = UserProfile.objects.filter(
            subscription_type__in=['basic', 'premium'],
            subscription_end_date__lt=now()
        )
        
        count = 0
        for profile in expired_profiles:
            # Если включено автопродление, пытаемся продлить подписку
            if profile.auto_renewal and profile.yookassa_payment_id:
                try:
                    yookassa_service = YooKassaService()
                    # Проверяем, можно ли создать новый платеж для автопродления
                    # В реальности здесь должна быть логика создания рекуррентного платежа
                    # Пока просто возвращаем к пробной подписке
                    self.stdout.write(
                        f'Подписка пользователя {profile.user.username} истекла. '
                        f'Автопродление пока не реализовано, возвращаем к пробной подписке.'
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Ошибка при попытке автопродления для {profile.user.username}: {str(e)}'
                        )
                    )
            
            # Возвращаем к пробной подписке
            old_type = profile.subscription_type
            profile.subscription_type = 'trial'
            profile.subscription_end_date = None
            profile.auto_renewal = False
            profile.yookassa_payment_id = None
            profile.save()
            
            count += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f'Подписка пользователя {profile.user.username} '
                    f'({old_type}) истекла и возвращена к пробной'
                )
            )
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Истекших подписок не найдено'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Обработано {count} истекших подписок')
            )

