from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0014_remove_brand_from_product_titles"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="model_rfa_glb_preview",
            field=models.CharField(
                blank=True,
                help_text="Автоматически создается конвертацией RFA -> GLB",
                max_length=500,
                verbose_name="GLB-превью для RFA",
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="model_rfa_convert_status",
            field=models.CharField(
                default="idle",
                help_text="idle, queued, processing, ready, failed",
                max_length=20,
                verbose_name="Статус конвертации RFA",
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="model_rfa_convert_error",
            field=models.TextField(blank=True, verbose_name="Ошибка конвертации RFA"),
        ),
    ]

