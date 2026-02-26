# Generated manually for Free/Trial/Basic/Pro

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_userprofile_subscription_start_date'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='subscription_type',
            field=models.CharField(choices=[('free', 'Free'), ('trial', 'Trial'), ('basic', 'Базовый'), ('pro', 'Pro'), ('premium', 'Pro (legacy)')], default='free', max_length=10, verbose_name='Тип подписки'),
        ),
    ]
