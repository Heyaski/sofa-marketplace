# Generated manually for Trial gradual category unlock

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0012_remove_cp_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='unlock_day',
            field=models.PositiveSmallIntegerField(default=0, help_text='В день Trial: 0 — сразу, 4 — на 4-й день, 8 — на 8-й, 12 — на 12-й. Для обычных тарифов — 0.', verbose_name='День открытия (Trial)'),
        ),
    ]
