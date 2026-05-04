from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_userprofile_license_key_hash'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='avatars/', verbose_name='Аватар'),
        ),
    ]

