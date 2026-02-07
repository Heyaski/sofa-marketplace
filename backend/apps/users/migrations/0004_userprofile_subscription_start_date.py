# Generated manually - колонка может уже существовать (другая 0004)
# Используем SeparateDatabaseAndState чтобы не ломать БД
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_userprofile_subscription_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='userprofile',
                    name='subscription_start_date',
                    field=models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name='Дата начала подписки',
                        help_text='Дата начала активной подписки'
                    ),
                ),
            ],
            database_operations=[],  # Колонка уже есть - не трогаем БД
        ),
    ]
