"""GLB → USDZ для AR Quick Look на iPhone (из ваших GLB на сайте)."""
from __future__ import annotations

import logging
import os
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.catalog.file_urls import is_ephemeral_external_model_url
from apps.catalog.models import Product
from apps.catalog.rfa_converter import _build_command_args, _load_file_bytes

logger = logging.getLogger(__name__)

_USDZ_STORAGE_NAME = "ar_quicklook.usdz"


def _usdz_storage_key(product_id: int) -> str:
    return f"products/{product_id}/{_USDZ_STORAGE_NAME}"


def resolve_product_glb_ref(product: Product) -> str:
    """Путь/URL GLB для конвертации (поля модели или FileAsset)."""
    for field in ("model_glb", "model_rfa_glb_preview", "model_ar_glb"):
        val = (getattr(product, field) or "").strip()
        if not val:
            continue
        low = val.lower().split("?")[0]
        if not low.endswith((".glb", ".gltf")):
            continue
        if is_ephemeral_external_model_url(val):
            continue
        return val

    for asset in product.get_3d_model_assets():
        name = (getattr(asset.file, "name", "") or "").lower()
        if name.endswith((".glb", ".gltf")):
            return asset.file.name

    raise ValueError("У товара нет GLB для AR на iPhone.")


def _resolve_usdz_ref(product: Product) -> str | None:
    raw = (product.model_usdz or "").strip()
    if raw and raw.lower().split("?")[0].endswith(".usdz"):
        if not is_ephemeral_external_model_url(raw):
            return raw
    return None


def _run_converter(tmp_dir: Path, in_path: Path, out_path: Path, product_id: int) -> None:
    custom = getattr(settings, "GLB_TO_USDZ_COMMAND", "").strip()
    timeout = getattr(settings, "GLB_TO_USDZ_TIMEOUT_SEC", 600)

    if custom:
        command = custom.format(
            input=str(in_path),
            output=str(out_path),
            product_id=product_id,
            tmp_dir=str(tmp_dir),
        )
        args = _build_command_args(command)
    elif shutil.which("usd_from_gltf"):
        args = ["usd_from_gltf", str(in_path), str(out_path)]
    else:
        docker_image = getattr(
            settings, "GLB_TO_USDZ_DOCKER_IMAGE", "marlon360/usd-from-gltf:latest"
        ).strip()
        if not shutil.which("docker"):
            raise RuntimeError(
                "Конвертер GLB→USDZ не настроен. Установите usd_from_gltf, Docker "
                f"({docker_image}) или задайте GLB_TO_USDZ_COMMAND в .env."
            )
        in_rel = in_path.name
        out_rel = out_path.name
        args = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{tmp_dir}:/work",
            docker_image,
            f"/work/{in_rel}",
            f"/work/{out_rel}",
        ]

    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        stdout = (completed.stdout or "").strip()
        details = stderr or stdout or "unknown converter error"
        raise RuntimeError(f"GLB→USDZ: код {completed.returncode}: {details}")
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("GLB→USDZ: пустой выходной файл.")


def convert_glb_to_usdz_for_product(product_id: int) -> str:
    """Сконвертировать GLB товара в USDZ, сохранить в storage, обновить model_usdz."""
    product = Product.objects.get(pk=product_id)
    glb_ref = resolve_product_glb_ref(product)
    glb_bytes = _load_file_bytes(glb_ref)

    with tempfile.TemporaryDirectory(prefix=f"glb2usdz_{product_id}_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        in_path = tmp_path / "input.glb"
        out_path = tmp_path / "output.usdz"
        in_path.write_bytes(glb_bytes)
        _run_converter(tmp_path, in_path, out_path, product_id)

        target = _usdz_storage_key(product_id)
        with out_path.open("rb") as f:
            saved_path = default_storage.save(target, ContentFile(f.read()))
        saved_url = default_storage.url(saved_path)

    Product.objects.filter(pk=product_id).update(model_usdz=saved_url)
    logger.info("glb2usdz: product %s → %s", product_id, saved_path)
    return saved_url


def get_usdz_bytes_for_product(product_id: int) -> bytes:
    """Вернуть байты USDZ: из кэша, model_usdz или конвертация GLB→USDZ."""
    product = Product.objects.get(pk=product_id)

    existing = _resolve_usdz_ref(product)
    if existing:
        return _load_file_bytes(existing)

    storage_key = _usdz_storage_key(product_id)
    if default_storage.exists(storage_key):
        with default_storage.open(storage_key, "rb") as f:
            return f.read()

    convert_glb_to_usdz_for_product(product_id)
    with default_storage.open(storage_key, "rb") as f:
        return f.read()


def product_can_ios_ar(product: Product) -> bool:
    """Есть GLB для автогенерации USDZ или уже готовый USDZ."""
    if _resolve_usdz_ref(product):
        return True
    if default_storage.exists(_usdz_storage_key(product.pk)):
        return True
    try:
        resolve_product_glb_ref(product)
        return True
    except ValueError:
        return False


def maybe_queue_glb_to_usdz(product: Product) -> None:
    """Фоновая конвертация после появления GLB (не блокирует импорт)."""
    if not getattr(settings, "GLB_TO_USDZ_ENABLED", True):
        return
    if not product.pk:
        return
    if _resolve_usdz_ref(product):
        return
    if default_storage.exists(_usdz_storage_key(product.pk)):
        return
    try:
        resolve_product_glb_ref(product)
    except ValueError:
        return
    from apps.catalog.tasks import convert_glb_to_usdz_task

    convert_glb_to_usdz_task.delay(product.pk)
