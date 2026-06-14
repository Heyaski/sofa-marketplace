from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("users", "0008_userprofile_plugin_settings"),
    ]

    operations = [
        migrations.CreateModel(
            name="PluginPlatform",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=128, verbose_name="Название")),
                ("slug", models.SlugField(max_length=64, unique=True, verbose_name="Код")),
                ("api_base_url", models.URLField(help_text="Например https://api.vizhub.pro/api", verbose_name="URL API")),
                (
                    "database_alias",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Пусто = default. Нужен DATABASE router для нескольких БД на одном сервере.",
                        max_length=32,
                        verbose_name="Alias БД Django",
                    ),
                ),
                ("is_default", models.BooleanField(default=False, verbose_name="По умолчанию")),
                ("is_active", models.BooleanField(default=True, verbose_name="Активна")),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name": "Площадка плагина",
                "verbose_name_plural": "Площадки плагина",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="PluginActivationToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(db_index=True, max_length=64, unique=True)),
                (
                    "subdomain_key",
                    models.CharField(
                        db_index=True,
                        help_text="Первые 32 символа token_hash — поддомен https://{subdomain_key}.vizhub.pro",
                        max_length=32,
                        unique=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("revoked", models.BooleanField(default=False)),
                (
                    "platform",
                    models.ForeignKey(
                        blank=True,
                        help_text="Пусто = доступ ко всем площадкам профиля",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activation_tokens",
                        to="plugin.pluginplatform",
                    ),
                ),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plugin_activation_tokens",
                        to="users.userprofile",
                    ),
                ),
            ],
            options={
                "verbose_name": "Токен активации плагина",
                "verbose_name_plural": "Токены активации плагина",
                "ordering": ["-created_at"],
            },
        ),
    ]
