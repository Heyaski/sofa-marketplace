from django.conf import settings
from django.db import models

class Download(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="Пользователь")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, verbose_name="Товар")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")

    # Подготовка под реальные файлы
    file = models.FileField(upload_to="downloads/", blank=True, null=True, verbose_name="Файл")

    class Meta:
        verbose_name = "Загрузка"
        verbose_name_plural = "Загрузки"
        ordering = ['-created_at']

    def __str__(self):
        return f"Загрузка {self.product.title} для {self.user.username}"
