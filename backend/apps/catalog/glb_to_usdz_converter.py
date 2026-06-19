"""GLB → USDZ для AR Quick Look на iPhone (из ваших GLB на сайте)."""
from __future__ import annotations

import logging
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
_BLENDER_SCRIPT = Path(__file__).resolve().parent.parent / "tools" / "blender_glb_to_usdz.py"


def _usdz_storage_key(product_id: int) -> str:
    return f"products/{product_id}/{_USDZ_STORAGE_NAME}"


def _blender_bin() -> str | None:
    explicit = getattr(settings, "BLENDER_BIN", "").strip()
    if explicit:
        return explicit
    return shutil.which("blender")


def converter_is_configured() -> bool:
    """Есть способ сконвертировать GLB→USDZ (без Docker по умолчанию)."""
    if getattr(settings, "GLB_TO_USDZ_COMMAND", "").strip():
        return True
    if _blender_bin() and _BLENDER_SCRIPT.is_file():
        return True
    if shutil.which("usd_from_gltf"):
        return True
    if getattr(settings, "GLB_TO_USDZ_USE_DOCKER", False) and shutil.which("docker"):
        return True
    return False


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


def _build_blender_command(in_path: Path, out_path: Path) -> str:
    blender = _blender_bin()
    if not blender:
        raise RuntimeError("Blender не найден (sudo apt install blender).")
    script = _BLENDER_SCRIPT
    if not script.is_file():
        raise RuntimeError(f"Скрипт конвертации не найден: {script}")
    return (
        f'"{blender}" --background --python "{script}" -- '
        f'"{in_path}" "{out_path}"'
    )


def _run_converter(tmp_dir: Path, in_path: Path, out_path: Path, product_id: int) -> None:
    import os

    custom = getattr(settings, "GLB_TO_USDZ_COMMAND", "").strip()
    timeout = getattr(settings, "GLB_TO_USDZ_TIMEOUT_SEC", 600)
    env = os.environ.copy()
    env.setdefault("BLENDER_USER_CONFIG", str(tmp_dir / "blender_user"))
    env["LIBGL_ALWAYS_SOFTWARE"] = "1"

    if custom:
        command = custom.format(
            input=str(in_path),
            output=str(out_path),
            product_id=product_id,
            tmp_dir=str(tmp_dir),
        )
        args = _build_command_args(command)
    elif _blender_bin() and _BLENDER_SCRIPT.is_file():
        command = _build_blender_command(in_path, out_path)
        args = _build_command_args(command)
    elif shutil.which("usd_from_gltf"):
        args = ["usd_from_gltf", str(in_path), str(out_path)]
    elif getattr(settings, "GLB_TO_USDZ_USE_DOCKER", False) and shutil.which("docker"):
        docker_image = getattr(
            settings, "GLB_TO_USDZ_DOCKER_IMAGE", "marlon360/usd-from-gltf:latest"
        ).strip()
        args = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{tmp_dir}:/work",
            docker_image,
            f"/work/{in_path.name}",
            f"/work/{out_path.name}",
        ]
    else:
        raise RuntimeError(
            "GLB→USDZ не настроен. Установите Blender (sudo apt install blender) "
            "или задайте GLB_TO_USDZ_COMMAND в backend/.env."
        )

    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        stdout = (completed.stdout or "").strip()
        details = stderr or stdout or "unknown converter error"
        raise RuntimeError(f"GLB→USDZ: код {completed.returncode}: {details}")
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("GLB→USDZ: пустой выходной файл.")


def convert_glb_to_usdz_for_product(product_id: int) -> str:
    """Сконвертировать GLB товара в USDZ, сохранить в storage, обновить model_usdz."""
    if not converter_is_configured():
        raise RuntimeError(
            "Конвертер GLB→USDZ не настроен. На сервере: sudo apt install blender"
        )

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
    """iPhone AR доступен: есть GLB и настроен конвертер (или уже есть USDZ)."""
    if _resolve_usdz_ref(product):
        return True
    if default_storage.exists(_usdz_storage_key(product.pk)):
        return True
    if not converter_is_configured():
        return False
    try:
        resolve_product_glb_ref(product)
        return True
    except ValueError:
        return False


def maybe_queue_glb_to_usdz(product: Product) -> None:
    """Фоновая конвертация после появления GLB (не блокирует импорт)."""
    if not getattr(settings, "GLB_TO_USDZ_ENABLED", True):
        return
    if not converter_is_configured():
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
