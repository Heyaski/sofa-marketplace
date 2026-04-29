# Generated manually for RevitBoost tariffs

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0002_rename_monthly_price_plan_price_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='price_yearly',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Сумма к оплате за год. Пусто — годовой тариф недоступен.', max_digits=10, null=True, verbose_name='Цена за год (руб.)'),
        ),
        migrations.AddField(
            model_name='plan',
            name='price_yearly_per_month',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Цена за год в пересчёте на месяц (руб.)'),
        ),
        migrations.AddField(
            model_name='plan',
            name='revit_access',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Доступ к Revit-моделям'),
        ),
        migrations.AddField(
            model_name='plan',
            name='script_access',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Доступ к скрипту замены'),
        ),
        migrations.AddField(
            model_name='plan',
            name='highpoly_access',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Доступ к high-poly'),
        ),
        migrations.AddField(
            model_name='plan',
            name='limits',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Лимиты и особенности'),
        ),
        migrations.AddField(
            model_name='plan',
            name='order',
            field=models.PositiveIntegerField(default=0, verbose_name='Порядок в таблице'),
        ),
        migrations.AlterField(
            model_name='plan',
            name='price',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Цена помесячно (руб.)'),
        ),
        migrations.AddField(
            model_name='plan',
            name='subscription_type',
            field=models.CharField(blank=True, choices=[('free', 'Free'), ('trial', 'Trial'), ('basic', 'Базовый'), ('pro', 'Pro'), ('premium', 'Pro (legacy)')], help_text='free, trial, basic, pro', max_length=10, null=True, unique=True, verbose_name='Тип подписки'),
        ),
    ]
