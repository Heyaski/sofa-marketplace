# Migration: add Category.order field for admin reordering
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0008_product_color_rgb'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='order',
            field=models.PositiveIntegerField(default=0, help_text='Меньше — выше в списке', verbose_name='Порядок'),
        ),
        migrations.AlterModelOptions(
            name='category',
            options={'ordering': ['order', 'id'], 'verbose_name': 'Категория', 'verbose_name_plural': 'Категории'},
        ),
    ]
