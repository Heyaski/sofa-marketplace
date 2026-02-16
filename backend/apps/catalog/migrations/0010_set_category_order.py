# Data migration: set unique order values for existing categories
from django.db import migrations


def set_initial_order(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    for i, cat in enumerate(Category.objects.all(), start=1):
        cat.order = i
        cat.save(update_fields=["order"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0009_category_order"),
    ]

    operations = [
        migrations.RunPython(set_initial_order, noop),
    ]
