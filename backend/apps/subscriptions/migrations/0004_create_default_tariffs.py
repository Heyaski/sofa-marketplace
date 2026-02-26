# Generated manually - default tariff plans for RevitBoost

from django.db import migrations


def create_default_plans(apps, schema_editor):
    Plan = apps.get_model('subscriptions', 'Plan')
    
    plans_data = [
        {
            'name': 'Free',
            'subscription_type': 'free',
            'price': 0,
            'price_yearly': None,
            'price_yearly_per_month': None,
            'duration_days': 0,
            'description': 'Бесплатный тариф',
            'revit_access': '5 моделей сразу + 5 каждые 7 дней',
            'script_access': 'Демо-версия (водяные знаки + лимит 3 замены/день)',
            'highpoly_access': '1 модель в неделю (пробники)',
            'limits': '—',
            'order': 0,
        },
        {
            'name': 'Trial',
            'subscription_type': 'trial',
            'price': 0,
            'price_yearly': None,
            'price_yearly_per_month': None,
            'duration_days': 14,
            'description': 'Пробный период 14 дней',
            'revit_access': 'Полный (с постепенным открытием категорий)',
            'script_access': 'Полный',
            'highpoly_access': 'Полный (в рамках лимита 100 скачиваний)',
            'limits': '14 дней, 100 скачиваний всего',
            'order': 1,
        },
        {
            'name': 'Базовый',
            'subscription_type': 'basic',
            'price': 990,
            'price_yearly': 8280,
            'price_yearly_per_month': 690,
            'duration_days': 30,
            'description': 'Базовая подписка — для одиночных пользователей',
            'revit_access': 'Полный',
            'script_access': 'Полный',
            'highpoly_access': 'Полный + ежемесячные обновления',
            'limits': 'Для одиночных пользователей',
            'order': 2,
        },
        {
            'name': 'Pro',
            'subscription_type': 'pro',
            'price': 1990,
            'price_yearly': 17880,
            'price_yearly_per_month': 1490,
            'duration_days': 30,
            'description': 'Pro подписка — приоритетная поддержка',
            'revit_access': 'Полный + ранний доступ к новинкам',
            'script_access': 'Полный',
            'highpoly_access': 'Полный + расширенная коллекция + персональные подборы',
            'limits': 'Приоритетная поддержка, для команд 1–3 человек',
            'order': 3,
        },
        # legacy — для существующих подписчиков premium
        {
            'name': 'Pro (legacy)',
            'subscription_type': 'premium',
            'price': 1990,
            'price_yearly': 17880,
            'price_yearly_per_month': 1490,
            'duration_days': 30,
            'description': 'Pro (ранее Премиум)',
            'revit_access': 'Полный + ранний доступ к новинкам',
            'script_access': 'Полный',
            'highpoly_access': 'Полный + расширенная коллекция + персональные подборы',
            'limits': 'Приоритетная поддержка, для команд 1–3 человек',
            'order': 4,
        },
    ]
    for data in plans_data:
        Plan.objects.update_or_create(
            subscription_type=data['subscription_type'],
            defaults=data
        )


def reverse_plans(apps, schema_editor):
    Plan = apps.get_model('subscriptions', 'Plan')
    Plan.objects.filter(subscription_type__in=['free', 'trial']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0003_plan_tariff_fields'),
    ]

    operations = [
        migrations.RunPython(create_default_plans, reverse_plans),
    ]
