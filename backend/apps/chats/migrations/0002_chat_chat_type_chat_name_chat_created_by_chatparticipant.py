# Generated manually - chat_type, name, created_by, ChatParticipant
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='chat',
            name='chat_type',
            field=models.CharField(
                choices=[('private', 'Приватный'), ('group', 'Групповой')],
                default='private',
                max_length=10,
                verbose_name='Тип чата'
            ),
        ),
        migrations.AddField(
            model_name='chat',
            name='name',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Название (для групповых чатов)'),
        ),
        migrations.AddField(
            model_name='chat',
            name='created_by',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_chats',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Создатель чата'
            ),
        ),
        migrations.AlterField(
            model_name='chat',
            name='participant1',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='chats_as_participant1',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Участник 1 (для обратной совместимости)'
            ),
        ),
        migrations.AlterField(
            model_name='chat',
            name='participant2',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='chats_as_participant2',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Участник 2 (для обратной совместимости)'
            ),
        ),
        migrations.AlterUniqueTogether(
            name='chat',
            unique_together=set(),
        ),
        migrations.CreateModel(
            name='ChatParticipant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата присоединения')),
                ('is_admin', models.BooleanField(default=False, verbose_name='Администратор')),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='chats.chat', verbose_name='Чат')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_participations', to=settings.AUTH_USER_MODEL, verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Участник чата',
                'verbose_name_plural': 'Участники чатов',
                'unique_together': {('chat', 'user')},
            },
        ),
    ]
