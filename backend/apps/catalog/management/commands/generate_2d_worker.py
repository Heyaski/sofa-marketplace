"""
Воркеры для generate_2d_from_glb (multiprocessing spawn).

Без импорта Django-моделей на уровне модуля — иначе AppRegistryNotReady в дочерних процессах.
"""

from __future__ import annotations

import os

import django


def _allow_sync_orm_with_playwright() -> None:
    os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"
    from django.db import close_old_connections

    close_old_connections()


def _save_product_preview_png(product_id: int, png: bytes) -> None:
    import time

    from django.core.files.base import ContentFile
    from django.db import close_old_connections
    from django.db.utils import OperationalError

    from apps.catalog.glb_2d_preview import _invalidate_product_cache
    from apps.catalog.models import Product

    name = f"glb2d_{product_id}.png"
    max_attempts = 12
    for attempt in range(max_attempts):
        close_old_connections()
        try:
            product = Product.objects.filter(pk=product_id).first()
            if not product:
                raise ValueError("no-product")
            product.image.save(name, ContentFile(png), save=True)
            _invalidate_product_cache(product_id)
            return
        except OperationalError as exc:
            msg = str(exc).lower()
            if "locked" not in msg or attempt >= max_attempts - 1:
                raise
            time.sleep(min(30.0, 0.75 * (attempt + 1)))


def render_one(product_id: int, force: bool, session) -> dict:
    from django.db import close_old_connections

    from apps.catalog.glb_2d_preview import (
        _infer_load_file_type,
        load_primary_glb_bytes,
        product_lacks_catalog_2d,
        render_glb_bytes_to_png,
    )
    from apps.catalog.models import Product

    if session is not None:
        _allow_sync_orm_with_playwright()

    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return {"status": "error", "reason": "no-product"}
    if not force and not product_lacks_catalog_2d(product):
        return {"status": "skipped", "reason": "has-2d"}
    raw = load_primary_glb_bytes(product)
    if not raw:
        return {"status": "skipped", "reason": "no-glb"}

    close_old_connections()

    try:
        if session is not None:
            ext = _infer_load_file_type(raw)
            png = session.render(raw, ext)
            renderer = "playwright"
        else:
            png, renderer = render_glb_bytes_to_png(raw)
    except Exception as e:
        return {"status": "error", "reason": str(e)[:300]}

    try:
        _save_product_preview_png(product_id, png)
    except Exception as e:
        return {"status": "error", "reason": str(e)[:300]}

    return {"status": "ok", "renderer": renderer}


def worker_process(product_ids: list, force: bool, result_queue) -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    from django.conf import settings as dj_settings

    from apps.catalog.glb_2d_preview import PlaywrightSession

    use_pw = getattr(dj_settings, "GLB_2D_USE_PLAYWRIGHT", True)
    try:
        if use_pw:
            _allow_sync_orm_with_playwright()
        session = PlaywrightSession().__enter__() if use_pw else None
    except Exception:
        session = None

    try:
        for product_id in product_ids:
            result = render_one(product_id, force=force, session=session)
            st = result.get("status", "error")
            renderer = result.get("renderer", "?")
            result_queue.put((product_id, st, renderer))
    finally:
        if session:
            session.__exit__(None, None, None)
        result_queue.put(None)
