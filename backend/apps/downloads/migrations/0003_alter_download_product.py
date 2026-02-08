# Generated manually - изменяет on_delete с PROTECT на CASCADE для удаления товаров

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('downloads', '0002_download_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='download',
            name='product',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='catalog.product', verbose_name='Товар'),
        ),
    ]
