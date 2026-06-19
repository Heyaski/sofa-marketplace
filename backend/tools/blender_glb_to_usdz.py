#!/usr/bin/env python3
"""
GLB → USDZ для AR Quick Look на iPhone (запуск внутри Blender, без Docker).
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
    print("Usage: blender --background --python blender_glb_to_usdz.py -- in.glb out.usdz", file=sys.stderr)
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

import bpy  # noqa: E402

MAX_TEX = 512
MAX_FACES = 80_000
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


def _mesh_face_count() -> int:
    total = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.data:
            total += len(obj.data.polygons)
    return total


def _decimate_meshes() -> None:
    """Draco-GLB раздувается при импорте — урезаем полигоны для AR Quick Look."""
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.data and len(o.data.polygons) > 0]
    total = sum(len(o.data.polygons) for o in meshes)
    print(f"Faces before decimate: {total}", file=sys.stderr)
    if total <= MAX_FACES:
        return

    ratio = max(0.005, min(1.0, MAX_FACES / total))
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new(name="DecimateAR", type="DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier="DecimateAR")

    print(f"Faces after decimate: {_mesh_face_count()}", file=sys.stderr)


def _shrink_scene_textures(tex_dir: Path) -> None:
    try:
        from PIL import Image
    except ImportError:
        print("PIL not in Blender — run: blender_python -m pip install Pillow", file=sys.stderr)
        for img in bpy.data.images:
            if img.size[0] <= 0:
                continue
            w, h = img.size
            if w > MAX_TEX or h > MAX_TEX:
                s = min(MAX_TEX / w, MAX_TEX / h)
                img.scale(max(1, int(w * s)), max(1, int(h * s)))
        return

    tex_dir.mkdir(parents=True, exist_ok=True)
    images = [img for img in bpy.data.images if img.size[0] > 0 or img.packed_file]
    print(f"Textures in scene: {len(images)}", file=sys.stderr)

    for idx, img in enumerate(images):
        try:
            if img.packed_file:
                img.unpack(method="WRITE_ORIGINAL")
            if img.filepath_raw and Path(bpy.path.abspath(img.filepath_raw)).is_file():
                pil = Image.open(bpy.path.abspath(img.filepath_raw))
            elif img.packed_file:
                pil = Image.open(io.BytesIO(img.packed_file.data))
            else:
                w, h = img.size
                px = list(img.pixels)
                rgba = bytearray()
                for i in range(0, len(px), 4):
                    rgba.extend(
                        (
                            int(max(0, min(255, px[i] * 255))),
                            int(max(0, min(255, px[i + 1] * 255))),
                            int(max(0, min(255, px[i + 2] * 255))),
                            int(max(0, min(255, px[i + 3] * 255))),
                        )
                    )
                pil = Image.frombytes("RGBA", (w, h), bytes(rgba))
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
            img.user_remap(new_img)
            if img.users == 0:
                bpy.data.images.remove(img)
            print(f"  tex {idx}: {jpath.stat().st_size // 1024} KB", file=sys.stderr)
        except Exception as exc:
            print(f"  tex {idx} skip: {exc}", file=sys.stderr)


def _usd_export(usd_path: Path) -> None:
    kwargs = {
        "filepath": str(usd_path),
        "export_textures": True,
        "overwrite_textures": True,
        "relative_paths": True,
    }
    for extra in (
        {"export_animation": False},
        {"export_armatures": False},
        {"export_hair": False},
        {"export_curves": False},
    ):
        try:
            bpy.ops.wm.usd_export(**kwargs, **extra)
            return
        except TypeError:
            kwargs.update(extra)
        except Exception:
            break
    try:
        bpy.ops.wm.usd_export(**kwargs)
    except TypeError:
        bpy.ops.wm.usd_export(filepath=str(usd_path))


bpy.ops.wm.read_factory_settings(use_empty=True)

if not _usd_export_available():
    print("USD export unavailable", file=sys.stderr)
    sys.exit(1)

try:
    bpy.ops.import_scene.gltf(filepath=str(inp))
except Exception as exc:
    print(f"GLB import failed: {exc}", file=sys.stderr)
    sys.exit(1)

_decimate_meshes()
_shrink_scene_textures(pkg / "textures")

usd_path = pkg / "model.usdc"
try:
    _usd_export(usd_path)
except Exception as exc:
    print(f"USD export failed: {exc}", file=sys.stderr)
    sys.exit(1)

if not usd_path.is_file() or usd_path.stat().st_size == 0:
    print("USD export empty", file=sys.stderr)
    sys.exit(1)

usd_file = usd_path
others = [
    f
    for f in sorted(pkg.rglob("*"))
    if f.is_file()
    and f.resolve() != usd_file.resolve()
    and f.suffix.lower() in PACK_EXT
]

total = usd_file.stat().st_size + sum(f.stat().st_size for f in others)
print(
    f"Pack: usd={usd_file.stat().st_size // 1024}KB + {len(others)} files, total={total // (1024 * 1024)}MB",
    file=sys.stderr,
)

with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as zf:
    zf.write(usd_file, usd_file.relative_to(pkg).as_posix())
    for f in others:
        zf.write(f, f.relative_to(pkg).as_posix())

size_mb = out.stat().st_size / (1024 * 1024)
print(f"OK: {out} ({size_mb:.1f} MB)")
if size_mb > 40:
    print(f"WARNING: USDZ {size_mb:.1f} MB — may fail on iPhone", file=sys.stderr)
