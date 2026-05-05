"""Распознавание нестабильных URL моделей (временные ключи, чужие CDN)."""


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
    return is_ephemeral_external_model_url(ex)
