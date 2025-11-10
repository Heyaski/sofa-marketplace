# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='subscription_type',
            field=models.CharField(
                choices=[('trial', 'Пробная'), ('basic', 'Базовая'), ('premium', 'Премиум')],
                default='trial',
                max_length=10,
                verbose_name='Тип подписки'
            ),
        ),
    ]

