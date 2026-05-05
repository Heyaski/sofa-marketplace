from django.conf import settings
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from apps.catalog.models import Product
from apps.catalog.tasks import convert_rfa_to_glb_task


def _is_revit_rfa_url(url: str | None) -> bool:
    if not url or not str(url).strip():
        return False
    return str(url).strip().lower().split("?")[0].endswith(".rfa")


@receiver(pre_save, sender=Product)
def remember_old_rfa(sender, instance: Product, **kwargs):
    if not instance.pk:
        instance._old_model_rfa = None
        return
    old = Product.objects.filter(pk=instance.pk).only("model_rfa").first()
    instance._old_model_rfa = old.model_rfa if old else None


@receiver(post_save, sender=Product)
def queue_rfa_conversion(sender, instance: Product, created: bool, **kwargs):
    if not getattr(settings, "RFA_CONVERT_ENABLED", True):
        return
    if not _is_revit_rfa_url(instance.model_rfa):
        return
    old_rfa = getattr(instance, "_old_model_rfa", None)
    rfa_changed = created or old_rfa != instance.model_rfa
    has_preview = bool((instance.model_rfa_glb_preview or "").strip())
    # Раньше при неизменном RFA задача не ставилась — GLB-превью с S3 так и не появлялся
    # (остались только ссылки zaohaowu в model_glb).
    if not rfa_changed and has_preview:
        return

    Product.objects.filter(pk=instance.pk).update(
        model_rfa_convert_status="queued",
        model_rfa_convert_error="",
    )
    convert_rfa_to_glb_task.delay(instance.pk)

