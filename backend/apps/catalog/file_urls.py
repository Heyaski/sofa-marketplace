"""Распознавание нестабильных URL моделей (временные ключи, чужие CDN)."""


def url_path_extension(url: str | None) -> str:
    """Расширение из пути URL (без query), с ведущей точкой или ''."""
    if not url or not str(url).strip():
        return ""
    base = str(url).strip().lower().split("?")[0].rstrip("/")
    for ext in (".glb", ".gltf", ".usdz", ".fbx", ".rfa", ".ifc"):
        if base.endswith(ext):
            return ext
    return ""


def url_has_usable_model_extension(url: str | None, ext: str) -> bool:
    """URL с нужным расширением и не протухший CDN (для бейджей админки)."""
    if not url or not str(url).strip():
        return False
    want = ext.lower() if ext.startswith(".") else f".{ext.lower()}"
    if url_path_extension(url) != want:
        return False
    return not is_ephemeral_external_model_url(url)


def url_looks_like_browser_model_file(url: str | None) -> bool:
    """
    True если путь в URL похож на формат, который открывает model-viewer (.glb/.gltf/.usdz).
    Не путать с полем Product.model_glb — туда иногда попадает .fbx или другой URL из импорта.
    """
    if not url or not str(url).strip():
        return False
    base = str(url).strip().lower().split("?")[0].rstrip("/")
    return base.endswith((".glb", ".gltf", ".usdz"))


def is_ephemeral_external_model_url(url: str | None) -> bool:
    """
    True если ссылка с высокой вероятностью перестанет открываться (истечёт ключ и т.п.).
    Такие URL не должны перекрывать файл, уже лежащий в нашем S3 (FileAsset).
    """
    if not url:
        return False
    low = str(url).lower().strip()
    if "auth_key=" in low:
        return True
    for host in (
        "zaohaowu.net",
        "zaonaowu.net",
        "hitem3dstatic",
        "volcengine.com",
        "volccdn.com",
    ):
        if host in low:
            return True
    return False


def url_is_trusted_storage(url: str | None) -> bool:
    """URL ведёт на наш S3 / media, а не на чужой CDN из Excel."""
    low = (url or "").lower().strip()
    if not low.startswith(("http://", "https://")):
        return False
    try:
        from django.conf import settings

        bucket = (getattr(settings, "AWS_STORAGE_BUCKET_NAME", None) or "").lower()
        if bucket and bucket in low:
            return True
        endpoint = (getattr(settings, "AWS_S3_ENDPOINT_URL", None) or "").lower()
        if endpoint:
            host = endpoint.replace("https://", "").replace("http://", "").split("/")[0]
            if host and host in low:
                return True
        custom = (getattr(settings, "AWS_S3_CUSTOM_DOMAIN", None) or "").lower()
        if custom and custom in low:
            return True
    except Exception:
        pass
    if "storage.beget.cloud" in low and ("/assets/" in low or "/products/" in low):
        return True
    if low.startswith("/media/") or "/media/assets/" in low:
        return True
    return False


def should_replace_product_model_url_with_asset(existing: str | None, asset_url: str) -> bool:
    """Обновлять ли поле товара URL-ом из загруженного в storage FileAsset."""
    ex = (existing or "").strip()
    au = (asset_url or "").strip()
    if not au:
        return False
    if not ex:
        return True
    if ex == au:
        return False
    if is_ephemeral_external_model_url(ex):
        return True
    # Excel часто кладёт не-GLB или не-http — не блокируем подстановку S3.
    if not url_looks_like_browser_model_file(ex):
        return True
    # Уже есть чужой http, а в FileAsset — наш S3.
    if url_is_trusted_storage(au) and not url_is_trusted_storage(ex):
        return True
    return False
