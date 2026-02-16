# Migration: add Category.order for drag-drop sorting in admin
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0008_product_color_rgb'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='order',
            field=models.PositiveIntegerField(db_index=True, default=0, verbose_name='Порядок'),
        ),
        migrations.AlterModelOptions(
            name='category',
            options={'ordering': ['order', 'id'], 'verbose_name': 'Категория', 'verbose_name_plural': 'Категории'},
        ),
    ]
