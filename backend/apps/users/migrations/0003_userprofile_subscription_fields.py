# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_userprofile_subscription_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='subscription_end_date',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Дата окончания подписки'),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='auto_renewal',
            field=models.BooleanField(default=False, verbose_name='Автопродление подписки'),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='yookassa_payment_id',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='ID платежа ЮКассы'),
        ),
    ]

