from django.apps import AppConfig


class PluginConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.plugin'
    verbose_name = 'API для плагина'
