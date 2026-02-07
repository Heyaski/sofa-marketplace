# Generated manually - добавляет share_token для публичных ссылок на корзину
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('baskets', '0003_basket_name_basket_updated_at_basketitem_format'),
    ]

    operations = [
        migrations.AddField(
            model_name='basket',
            name='share_token',
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                unique=True,
                verbose_name='Токен для публичной ссылки'
            ),
        ),
    ]
