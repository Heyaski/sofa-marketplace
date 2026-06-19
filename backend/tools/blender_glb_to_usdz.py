#!/usr/bin/env python3
"""
GLB → USDZ для AR Quick Look на iPhone (запуск внутри Blender, без Docker).

  blender --background --python blender_glb_to_usdz.py -- input.glb output.usdz

Нужен Blender с поддержкой USD (официальный tarball с blender.org).
"""
from __future__ import annotations

import shutil
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
pkg = work / "usdz_pkg"

if not inp.is_file():
    print(f"Input not found: {inp}", file=sys.stderr)
    sys.exit(1)

if pkg.exists():
    shutil.rmtree(pkg)
pkg.mkdir()

import bpy  # noqa: E402  # только внутри Blender

MAX_TEX = 1024
PACK_EXT = {".usdc", ".usda", ".usd", ".png", ".jpg", ".jpeg", ".webp"}


def _enable_usd_addon() -> None:
    try:
        import addon_utils

        addon_utils.enable("io_scene_usd", default_set=True)
    except Exception:
        pass


def _usd_export_available() -> bool:
    _enable_usd_addon()
    return hasattr(bpy.ops.wm, "usd_export")


def _prepare_textures() -> None:
    """Распаковать GLB-текстуры, уменьшить и сохранить как JPEG."""
    tex_dir = pkg / "textures"
    tex_dir.mkdir(parents=True, exist_ok=True)
    for idx, img in enumerate(bpy.data.images):
        if img.size[0] <= 0 or img.size[1] <= 0:
            continue
        try:
            if img.packed_file:
                img.unpack(method="WRITE_ORIGINAL")
        except Exception:
            pass
        w, h = img.size
        if w > MAX_TEX or h > MAX_TEX:
            scale = min(MAX_TEX / w, MAX_TEX / h)
            img.scale(max(1, int(w * scale)), max(1, int(h * scale)))
        jpath = tex_dir / f"tex_{idx:03d}.jpg"
        try:
            img.file_format = "JPEG"
            img.filepath_raw = str(jpath)
            img.save()
        except Exception as exc:
            print(f"texture {idx} save skipped: {exc}", file=sys.stderr)


def _collect_pack_files() -> tuple[Path, list[Path]]:
    usd_candidates = sorted(pkg.glob("model.usd*")) + sorted(pkg.glob("*.usdc"))
    usd_file = next((f for f in usd_candidates if f.is_file()), None)
    if not usd_file:
        usd_file = next(
            (f for f in sorted(pkg.rglob("*")) if f.is_file() and f.suffix.lower() in {".usdc", ".usda", ".usd"}),
            None,
        )
    if not usd_file:
        print("USD file not found in package dir", file=sys.stderr)
        sys.exit(1)

    others: list[Path] = []
    for f in sorted(pkg.rglob("*")):
        if not f.is_file():
            continue
        if f.resolve() == usd_file.resolve():
            continue
        if f.suffix.lower() not in PACK_EXT:
            continue
        others.append(f)
    return usd_file, others


bpy.ops.wm.read_factory_settings(use_empty=True)

if not _usd_export_available():
    print("USD export unavailable (install official Blender with USD)", file=sys.stderr)
    sys.exit(1)

try:
    bpy.ops.import_scene.gltf(filepath=str(inp))
except Exception as exc:
    print(f"GLB import failed: {exc}", file=sys.stderr)
    sys.exit(1)

_prepare_textures()

usd_path = pkg / "model.usdc"
try:
    bpy.ops.wm.usd_export(
        filepath=str(usd_path),
        export_textures=True,
        overwrite_textures=True,
        relative_paths=True,
    )
except TypeError:
    bpy.ops.wm.usd_export(filepath=str(usd_path))
except Exception as exc:
    print(f"USD export failed: {exc}", file=sys.stderr)
    sys.exit(1)

if not usd_path.is_file() or usd_path.stat().st_size == 0:
    print("USD export produced empty file", file=sys.stderr)
    sys.exit(1)

# Дополнительно сжимаем оставшиеся PNG в pkg (не во всём temp)
try:
    from PIL import Image

    for f in list(pkg.rglob("*.png")):
        if f.stat().st_size < 128_000:
            continue
        jpg = f.with_suffix(".jpg")
        Image.open(f).convert("RGB").save(jpg, "JPEG", quality=82, optimize=True)
        f.unlink()
except Exception as exc:
    print(f"PIL PNG→JPEG skipped: {exc}", file=sys.stderr)

usd_file, extra_files = _collect_pack_files()

# AR Quick Look: USD-файл первым, только содержимое pkg/
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as zf:
    zf.write(usd_file, usd_file.relative_to(pkg).as_posix())
    for f in extra_files:
        zf.write(f, f.relative_to(pkg).as_posix())

if not out.is_file() or out.stat().st_size == 0:
    print("USDZ pack failed", file=sys.stderr)
    sys.exit(1)

size_mb = out.stat().st_size / (1024 * 1024)
print(f"OK: {out} ({size_mb:.1f} MB)")
if size_mb > 40:
    print(
        f"WARNING: USDZ {size_mb:.1f} MB — для iPhone Quick Look лучше < 25 MB",
        file=sys.stderr,
    )
