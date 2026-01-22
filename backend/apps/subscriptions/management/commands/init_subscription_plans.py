"""
Management команда для создания начальных планов подписок
Запускать после миграции для создания планов basic и premium
"""
from django.core.management.base import BaseCommand
from apps.subscriptions.models import Plan


class Command(BaseCommand):
    help = 'Создает начальные планы подписок (basic и premium)'

    def handle(self, *args, **options):
        self.stdout.write('Создание планов подписок...')
        
        plans_data = [
            {
                'name': 'Базовая',
                'subscription_type': 'basic',
                'price': 1000.00,
                'duration_days': 30,
                'description': 'Базовая подписка - 10 скачиваний в месяц',
                'is_active': True
            },
            {
                'name': 'Премиум',
                'subscription_type': 'premium',
                'price': 8000.00,
                'duration_days': 30,
                'description': 'Премиум подписка - безлимитное скачивание',
                'is_active': True
            }
        ]
        
        created_count = 0
        updated_count = 0
        
        for plan_data in plans_data:
            plan, created = Plan.objects.update_or_create(
                subscription_type=plan_data['subscription_type'],
                defaults={
                    'name': plan_data['name'],
                    'price': plan_data['price'],
                    'duration_days': plan_data['duration_days'],
                    'description': plan_data['description'],
                    'is_active': plan_data['is_active']
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Создан план: {plan.name} ({plan.subscription_type}) - {plan.price} руб.'
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'↻ Обновлен план: {plan.name} ({plan.subscription_type}) - {plan.price} руб.'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nГотово! Создано: {created_count}, Обновлено: {updated_count}'
            )
        )
