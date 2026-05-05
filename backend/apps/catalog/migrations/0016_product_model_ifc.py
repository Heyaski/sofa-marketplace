# Generated manually: separate IFC from RFA field

from django.db import migrations, models


def move_ifc_urls_to_model_ifc(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    for p in Product.objects.exclude(model_rfa="").iterator(chunk_size=500):
        mr = (p.model_rfa or "").strip()
        if not mr:
            continue
        base = mr.split("?")[0].lower()
        if base.endswith(".ifc"):
            p.model_ifc = p.model_rfa
            p.model_rfa = ""
            p.save(update_fields=["model_ifc", "model_rfa"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0015_product_rfa_preview_and_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="model_ifc",
            field=models.CharField(
                blank=True,
                help_text="Путь или URL файла IFC (отдельно от Revit .rfa)",
                max_length=500,
                verbose_name="IFC файл",
            ),
        ),
        migrations.RunPython(move_ifc_urls_to_model_ifc, migrations.RunPython.noop),
    ]
