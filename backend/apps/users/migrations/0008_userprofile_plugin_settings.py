from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_userprofile_avatar"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="plugin_offline_models_path",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Локальная папка на ПК (D:\\Models или \\\\NAS\\share). Плагин ищет GLB/RFA здесь до скачивания из облака.",
                max_length=512,
                verbose_name="Папка моделей для плагина (офлайн)",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="plugin_storage_backend",
            field=models.CharField(
                choices=[
                    ("vizhub_cloud", "Только облако VizHub"),
                    ("local_first", "Сначала локально, затем облако"),
                    ("local_only", "Только локальная папка"),
                ],
                default="local_first",
                max_length=32,
                verbose_name="Источник файлов для плагина",
            ),
        ),
    ]
