# Generated manually - добавляет отсутствующее поле color_rgb
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0007_product_article_product_availability_product_brand_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='color_rgb',
            field=models.CharField(
                blank=True,
                max_length=50,
                verbose_name='Цвет RGB',
                help_text='RGB цвет в формате R,G,B (например: 255,128,64)'
            ),
        ),
    ]
