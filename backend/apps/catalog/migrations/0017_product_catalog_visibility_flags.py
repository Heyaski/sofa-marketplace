from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0016_product_model_ifc"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="catalog_visible_2d",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Денормализация: есть фото для сетки 2D.",
                verbose_name="Виден в 2D каталоге",
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="catalog_visible_3d",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Денормализация: есть стабильный GLB для model-viewer (обновляется при импорте/сохранении).",
                verbose_name="Виден в 3D каталоге",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["category", "is_active", "catalog_visible_3d"],
                name="catalog_prod_cat_3d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["category", "is_active", "catalog_visible_2d"],
                name="catalog_prod_cat_2d_idx",
            ),
        ),
    ]
