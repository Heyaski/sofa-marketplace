from django.conf import settings
from django.db import models

class Download(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    # Подготовка под реальные файлы
    file = models.FileField(upload_to="downloads/", blank=True, null=True)

    def __str__(self):
        return f"Загрузка {self.product.title} для {self.user.username}"
