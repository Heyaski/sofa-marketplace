# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='StaticPage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('page_type', models.CharField(choices=[('privacy', 'Политика конфиденциальности'), ('terms', 'Договор-оферта'), ('about', 'О нас'), ('contact', 'Контакты'), ('other', 'Другое')], max_length=20, unique=True, verbose_name='Тип страницы')),
                ('title', models.CharField(max_length=200, verbose_name='Заголовок')),
                ('content', models.TextField(help_text='HTML контент страницы', verbose_name='Содержание')),
                ('slug', models.SlugField(blank=True, help_text='Автоматически генерируется из заголовка', max_length=200, unique=True, verbose_name='URL-адрес')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активна')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создана')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлена')),
            ],
            options={
                'verbose_name': 'Статическая страница',
                'verbose_name_plural': 'Статические страницы',
                'ordering': ['page_type'],
            },
        ),
    ]

