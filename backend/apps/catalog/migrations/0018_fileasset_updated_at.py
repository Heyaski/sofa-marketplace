from django.db import migrations, models


def copy_created_at_to_updated_at(apps, schema_editor):
    FileAsset = apps.get_model("catalog", "FileAsset")
    for row in FileAsset.objects.only("pk", "created_at").iterator():
        FileAsset.objects.filter(pk=row.pk).update(updated_at=row.created_at)


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0017_product_catalog_visibility_flags"),
    ]

    operations = [
        migrations.AddField(
            model_name="fileasset",
            name="updated_at",
            field=models.DateTimeField(null=True, verbose_name="Дата обновления"),
        ),
        migrations.RunPython(copy_created_at_to_updated_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="fileasset",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="Дата обновления"),
        ),
        migrations.AlterField(
            model_name="fileasset",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, verbose_name="Дата создания"),
        ),
    ]
