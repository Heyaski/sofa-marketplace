from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('baskets', '0006_commercialproposalrequest_alter_basket_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='commercialproposalrequest',
            name='docx_file',
            field=models.FileField(blank=True, null=True, upload_to='commercial_proposals/', verbose_name='DOCX файл КП'),
        ),
    ]
