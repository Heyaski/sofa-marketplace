# Generated for plugin license key

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_subscription_choices_and_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='license_key_hash',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='SHA256 хеш ключа. Генерируется при активации подписки. Показывается пользователю в профиле.',
                max_length=64,
                null=True,
                unique=True,
                verbose_name='Хеш ключа лицензии'
            ),
        ),
    ]
