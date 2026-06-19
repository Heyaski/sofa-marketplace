#!/usr/bin/env python3
"""
GLB → USDZ для AR Quick Look на iPhone (запуск внутри Blender, без Docker).

  blender --background --python blender_glb_to_usdz.py -- input.glb output.usdz
"""
from __future__ import annotations

import io
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

MAX_TEX = 512
JPEG_QUALITY = 78
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


def _load_pil_image(img: bpy.types.Image):
    from PIL import Image

    if img.packed_file:
        return Image.open(io.BytesIO(img.packed_file.data))
    if img.filepath_raw:
        path = bpy.path.abspath(img.filepath_raw)
        if path and Path(path).is_file():
            return Image.open(path)
    w, h = img.size
    if w <= 0 or h <= 0:
        raise ValueError("empty image")
    # Пиксели из Blender (медленно, но надёжно)
    pixels = list(img.pixels)
    rgba = bytearray()
    for i in range(0, len(pixels), 4):
        rgba.extend(
            (
                int(max(0, min(255, pixels[i] * 255))),
                int(max(0, min(255, pixels[i + 1] * 255))),
                int(max(0, min(255, pixels[i + 2] * 255))),
                int(max(0, min(255, pixels[i + 3] * 255))),
            )
        )
    return Image.frombytes("RGBA", (w, h), bytes(rgba))


def _shrink_scene_textures(tex_dir: Path) -> None:
    """Уменьшить все текстуры сцены и подменить ссылки (PIL + user_remap)."""
    try:
        from PIL import Image
    except ImportError:
        print("PIL not found in Blender — fallback to img.scale(512)", file=sys.stderr)
        for img in bpy.data.images:
            if img.size[0] <= 0:
                continue
            w, h = img.size
            if w > MAX_TEX or h > MAX_TEX:
                s = min(MAX_TEX / w, MAX_TEX / h)
                img.scale(max(1, int(w * s)), max(1, int(h * s)))
        return

    tex_dir.mkdir(parents=True, exist_ok=True)
    images = [img for img in bpy.data.images if img.size[0] > 0 or img.packed_file or img.filepath_raw]
    print(f"Textures in scene: {len(images)}", file=sys.stderr)

    for idx, img in enumerate(images):
        try:
            if img.packed_file:
                try:
                    img.unpack(method="WRITE_ORIGINAL")
                except Exception:
                    pass
            pil = _load_pil_image(img)
            if pil.mode not in ("RGB", "RGBA"):
                pil = pil.convert("RGBA")
            pil.thumbnail((MAX_TEX, MAX_TEX), Image.Resampling.LANCZOS)
            if pil.mode == "RGBA":
                bg = Image.new("RGB", pil.size, (255, 255, 255))
                bg.paste(pil, mask=pil.split()[3])
                pil = bg
            else:
                pil = pil.convert("RGB")

            jpath = tex_dir / f"tex_{idx:03d}.jpg"
            pil.save(jpath, "JPEG", quality=JPEG_QUALITY, optimize=True)
            new_img = bpy.data.images.load(str(jpath), check_existing=False)
            new_img.name = f"AR_{img.name}"[:63]
            img.user_remap(new_img)
            if img.users == 0:
                bpy.data.images.remove(img)
            print(f"  tex {idx}: {jpath.name} ({jpath.stat().st_size // 1024} KB)", file=sys.stderr)
        except Exception as exc:
            print(f"  tex {idx} skip ({img.name}): {exc}", file=sys.stderr)


def _collect_pack_files() -> tuple[Path, list[Path]]:
    usd_file = pkg / "model.usdc"
    if not usd_file.is_file():
        usd_file = next(
            (
                f
                for f in sorted(pkg.rglob("*"))
                if f.is_file() and f.suffix.lower() in {".usdc", ".usda", ".usd"}
            ),
            None,
        )
    if not usd_file:
        print("USD file not found in package dir", file=sys.stderr)
        sys.exit(1)

    others: list[Path] = []
    for f in sorted(pkg.rglob("*")):
        if not f.is_file() or f.resolve() == usd_file.resolve():
            continue
        if f.suffix.lower() not in PACK_EXT:
            continue
        others.append(f)
    return usd_file, others


def _shrink_orphan_textures_in_pkg() -> None:
    """После USD export — ужать любые крупные PNG/JPEG в pkg."""
    try:
        from PIL import Image
    except ImportError:
        return

    for f in list(pkg.rglob("*")):
        if f.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        if f.stat().st_size < 400_000:
            continue
        try:
            pil = Image.open(f)
            pil.thumbnail((MAX_TEX, MAX_TEX), Image.Resampling.LANCZOS)
            jpg = f.with_suffix(".jpg")
            if pil.mode == "RGBA":
                bg = Image.new("RGB", pil.size, (255, 255, 255))
                bg.paste(pil, mask=pil.split()[3])
                pil = bg
            else:
                pil = pil.convert("RGB")
            pil.save(jpg, "JPEG", quality=JPEG_QUALITY, optimize=True)
            if jpg.resolve() != f.resolve():
                f.unlink(missing_ok=True)
        except Exception as exc:
            print(f"orphan shrink {f.name}: {exc}", file=sys.stderr)


bpy.ops.wm.read_factory_settings(use_empty=True)

if not _usd_export_available():
    print("USD export unavailable (install official Blender with USD)", file=sys.stderr)
    sys.exit(1)

try:
    bpy.ops.import_scene.gltf(filepath=str(inp))
except Exception as exc:
    print(f"GLB import failed: {exc}", file=sys.stderr)
    sys.exit(1)

_shrink_scene_textures(pkg / "textures")

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

_shrink_orphan_textures_in_pkg()

usd_file, extra_files = _collect_pack_files()

total = usd_file.stat().st_size + sum(f.stat().st_size for f in extra_files)
print(f"Pack: usd={usd_file.stat().st_size // 1024}KB + {len(extra_files)} files, total={total // (1024*1024)}MB", file=sys.stderr)

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
    print(f"WARNING: USDZ {size_mb:.1f} MB — may fail on iPhone Quick Look", file=sys.stderr)
