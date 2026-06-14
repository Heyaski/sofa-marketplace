from django.db import migrations


def create_default_platform(apps, schema_editor):
    PluginPlatform = apps.get_model("plugin", "PluginPlatform")
    if PluginPlatform.objects.exists():
        return
    PluginPlatform.objects.create(
        name="VizHub",
        slug="vizhub",
        api_base_url="https://api.vizhub.pro/api",
        is_default=True,
        is_active=True,
        sort_order=0,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("plugin", "0001_plugin_platform_and_tokens"),
    ]

    operations = [
        migrations.RunPython(create_default_platform, migrations.RunPython.noop),
    ]
