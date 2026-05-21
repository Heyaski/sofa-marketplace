"""Публичные URL для файлов в storage (локально и S3, в т.ч. glb2d_*.png)."""


def resolve_media_field_url(file_field, request=None) -> str | None:
    """
    Абсолютный URL для ImageField/FileField.
    Для S3 с S3_FILE_ACCESS_MODE=signed — через storage.url (подпись), не сырой .url.
    """
    if not file_field:
        return None
    name = getattr(file_field, "name", None) or ""
    if not str(name).strip():
        return None
    if not hasattr(file_field, "url"):
        return None

    from django.conf import settings

    use_signed = getattr(settings, "S3_FILE_ACCESS_MODE", "public") == "signed"
    try:
        if use_signed and hasattr(file_field, "storage"):
            image_url = file_field.storage.url(file_field.name)
        else:
            image_url = file_field.url
    except Exception:
        return None

    if not image_url:
        return None
    if str(image_url).startswith(("http://", "https://")):
        return image_url
    if request is not None:
        return request.build_absolute_uri(image_url)
    return image_url
