#!/usr/bin/env python3
"""
GLB → USDZ для AR Quick Look на iPhone (запуск внутри Blender, без Docker).

  blender --background --python blender_glb_to_usdz.py -- input.glb output.usdz

Нужен Blender с поддержкой USD (официальный tarball с blender.org).
Пакет Ubuntu «apt install blender» часто собран без USD — wm.usd_export недоступен.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1 :]
else:
    argv = []

if len(argv) < 2:
    print(
        "Usage: blender --background --python blender_glb_to_usdz.py -- input.glb output.usdz",
        file=sys.stderr,
    )
    sys.exit(2)

inp = Path(argv[0]).resolve()
out = Path(argv[1]).resolve()
work = inp.parent

if not inp.is_file():
    print(f"Input not found: {inp}", file=sys.stderr)
    sys.exit(1)

import bpy  # noqa: E402  # только внутри Blender


def _enable_usd_addon() -> None:
    try:
        import addon_utils

        addon_utils.enable("io_scene_usd", default_set=True)
    except Exception:
        pass


def _usd_export_available() -> bool:
    _enable_usd_addon()
    return hasattr(bpy.ops.wm, "usd_export")


bpy.ops.wm.read_factory_settings(use_empty=True)

if not _usd_export_available():
    print(
        "USD export unavailable in this Blender build (wm.usd_export missing).\n"
        "Ubuntu apt blender is usually built without USD.\n"
        "Install official Blender: backend/scripts/install_blender_usd.sh\n"
        "Then set BLENDER_BIN=/opt/blender-*/blender in backend/.env",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    bpy.ops.import_scene.gltf(filepath=str(inp))
except Exception as exc:
    print(f"GLB import failed: {exc}", file=sys.stderr)
    sys.exit(1)

# Quick Look на iPhone плохо переваривает 4K-текстуры — уменьшаем до 2048
max_tex = 2048
for img in bpy.data.images:
    w, h = img.size
    if w <= 0 or h <= 0:
        continue
    if w <= max_tex and h <= max_tex:
        continue
    scale = min(max_tex / w, max_tex / h)
    img.scale(max(1, int(w * scale)), max(1, int(h * scale)))

usd_path = work / "model.usdc"
try:
    bpy.ops.wm.usd_export(
        filepath=str(usd_path),
        export_textures=True,
        overwrite_textures=True,
        relative_paths=True,
    )
except TypeError:
    # Старые версии Blender — без части аргументов
    bpy.ops.wm.usd_export(filepath=str(usd_path))
except Exception as exc:
    print(f"USD export failed: {exc}", file=sys.stderr)
    sys.exit(1)

if not usd_path.is_file() or usd_path.stat().st_size == 0:
    print("USD export produced empty file", file=sys.stderr)
    sys.exit(1)

pack_ext = {".usdc", ".usd", ".usda", ".png", ".jpg", ".jpeg", ".webp", ".ktx", ".ktx2"}
extra_files: list[Path] = []
for f in sorted(work.rglob("*")):
    if not f.is_file():
        continue
    if f.resolve() in {out.resolve(), inp.resolve(), usd_path.resolve()}:
        continue
    if f.suffix.lower() not in pack_ext:
        continue
    extra_files.append(f)

# AR Quick Look требует: USD-файл первым в архиве (без сжатия)
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as zf:
    zf.write(usd_path, usd_path.relative_to(work).as_posix())
    for f in extra_files:
        zf.write(f, f.relative_to(work).as_posix())

if not out.is_file() or out.stat().st_size == 0:
    print("USDZ pack failed", file=sys.stderr)
    sys.exit(1)

print(f"OK: {out}")
