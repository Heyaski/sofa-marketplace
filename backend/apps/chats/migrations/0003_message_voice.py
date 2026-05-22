from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0002_chat_chat_type_chat_name_chat_created_by_chatparticipant'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='voice_file',
            field=models.FileField(blank=True, null=True, upload_to='chat_voice/', verbose_name='Голосовое сообщение'),
        ),
        migrations.AddField(
            model_name='message',
            name='voice_duration',
            field=models.PositiveIntegerField(default=0, verbose_name='Длительность голосового (сек)'),
        ),
        migrations.AlterField(
            model_name='message',
            name='message_type',
            field=models.CharField(
                choices=[
                    ('text', 'Текст'),
                    ('product', 'Товар'),
                    ('basket', 'Корзина'),
                    ('voice', 'Голосовое'),
                ],
                default='text',
                max_length=10,
                verbose_name='Тип сообщения',
            ),
        ),
    ]
