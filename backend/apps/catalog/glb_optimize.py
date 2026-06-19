"""Сжать встроенные текстуры GLB перед конвертацией в USDZ (iPhone AR)."""
from __future__ import annotations

import io
import logging
import shutil
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

MAX_TEXTURE = 512
JPEG_QUALITY = 80


def _resize_image_bytes(raw: bytes) -> bytes:
    pil = Image.open(io.BytesIO(raw))
    pil.thumbnail((MAX_TEXTURE, MAX_TEXTURE), Image.Resampling.LANCZOS)
    if pil.mode == "RGBA":
        bg = Image.new("RGB", pil.size, (255, 255, 255))
        bg.paste(pil, mask=pil.split()[3])
        pil = bg
    else:
        pil = pil.convert("RGB")
    out = io.BytesIO()
    pil.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def optimize_glb_for_ios_ar(src: Path, dst: Path, max_texture: int = MAX_TEXTURE) -> Path:
    """
    Уменьшить JPEG/PNG внутри GLB. Возвращает путь к файлу для Blender.
    При ошибке копирует исходник.
    """
    try:
        from pygltflib import GLTF2
    except ImportError:
        logger.warning("pygltflib не установлен — GLB без предобработки")
        shutil.copy(src, dst)
        return dst

    try:
        gltf = GLTF2().load_binary(str(src))
    except Exception as exc:
        logger.warning("GLB parse failed: %s", exc)
        shutil.copy(src, dst)
        return dst

    images = gltf.images or []
    if not images:
        shutil.copy(src, dst)
        return dst

    binary = bytearray(gltf.binary_blob() or b"")
    if not binary:
        shutil.copy(src, dst)
        return dst

    image_bv_indices = {
        img.bufferView for img in images if img.bufferView is not None
    }
    if not image_bv_indices:
        shutil.copy(src, dst)
        return dst

    views = list(enumerate(gltf.bufferViews or []))
    views.sort(key=lambda item: item[1].byteOffset or 0)

    new_bin = bytearray()
    new_offsets: dict[int, tuple[int, int]] = {}
    changed = False

    for idx, bv in views:
        pad = (4 - (len(new_bin) % 4)) % 4
        new_bin.extend(b"\x00" * pad)
        off = bv.byteOffset or 0
        data = bytes(binary[off : off + bv.byteLength])
        if idx in image_bv_indices:
            try:
                data = _resize_image_bytes(data)
                changed = True
                for img in images:
                    if img.bufferView == idx:
                        img.mimeType = "image/jpeg"
            except Exception as exc:
                logger.debug("image bv %s skip: %s", idx, exc)
        new_offsets[idx] = (len(new_bin), len(data))
        new_bin.extend(data)

    if not changed:
        shutil.copy(src, dst)
        return dst

    for idx, bv in enumerate(gltf.bufferViews or []):
        start, length = new_offsets[idx]
        bv.byteOffset = start
        bv.byteLength = length

    gltf.set_binary_blob(bytes(new_bin))
    gltf.save_binary(str(dst))
    logger.info(
        "GLB optimized: %s → %s (%.1f MB → %.1f MB)",
        src.name,
        dst.name,
        src.stat().st_size / (1024 * 1024),
        dst.stat().st_size / (1024 * 1024),
    )
    return dst
