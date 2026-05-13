"""
Генерация плоского превью (PNG) из GLB/GLTF для режима 2D каталога.
GLB не удаляется и не перезаписывается — заполняется только поле image, если других фото нет.

Порядок рендера:
1) GLB_PREVIEW_COMMAND — внешний пайплайн (Blender и т.п.), если задан.
2) Playwright + Chromium + <model-viewer> (локальный HTTP) — как «скрин» 3D в браузере
   (текстуры, PBR). Нужны: pip install playwright && playwright install chromium.
3) Matplotlib + trimesh — запасной путь без полноценных UV-текстур.
"""
from __future__ import annotations

import io
import logging
import os
import subprocess
import tempfile
import threading
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile

from apps.catalog.file_urls import is_ephemeral_external_model_url
from apps.catalog.models import Product
from apps.catalog.rfa_converter import _build_command_args, _load_file_bytes

logger = logging.getLogger(__name__)

_MAX_FACES_MATPLOTLIB = 14_000
_PREVIEW_SIZE = (768, 768)

# Кэш model-viewer.min.js — скачивается один раз рядом с этим модулем.
_MV_CACHE_PATH = Path(__file__).parent / "_model_viewer_cache.js"
_MV_DEFAULT_CDN = "https://unpkg.com/@google/model-viewer@3.4.0/dist/model-viewer.min.js"


def _get_model_viewer_js() -> Path:
    """
    Возвращает путь к локальному model-viewer.min.js.
    При первом вызове скачивает с CDN и сохраняет рядом с модулем.
    Если скачать не удалось и кэша нет — возвращает None (HTML будет грузить с CDN).
    """
    if _MV_CACHE_PATH.exists() and _MV_CACHE_PATH.stat().st_size > 10_000:
        return _MV_CACHE_PATH
    cdn_url = getattr(settings, "GLB_2D_MODEL_VIEWER_SCRIPT_URL", _MV_DEFAULT_CDN)
    try:
        logger.info("glb_2d: скачиваем model-viewer.min.js с %s ...", cdn_url)
        req = urllib.request.Request(cdn_url, headers={"User-Agent": "sofa-marketplace-glb-preview/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        _MV_CACHE_PATH.write_bytes(data)
        logger.info("glb_2d: model-viewer.min.js сохранён (%d байт)", len(data))
        return _MV_CACHE_PATH
    except Exception as e:
        logger.warning("glb_2d: не удалось скачать model-viewer.min.js: %s — будем грузить с CDN", e)
        return None


class _ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True


def _make_static_handler(root: Path):
    class _H(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, *_args, **_kwargs):
            pass

    return _H


def _render_with_playwright_screenshot(glb_bytes: bytes, file_ext: str) -> bytes | None:
    """
    Скриншот model-viewer в headless Chromium — визуально как карточка 3D на сайте.
    GLB + model-viewer.min.js отдаются с http://127.0.0.1 (file:// ломает fetch/WebGL).
    SwiftShader включён для WebGL без GPU.
    """
    if not getattr(settings, "GLB_2D_USE_PLAYWRIGHT", True):
        return None
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.info(
            "glb_2d: playwright не установлен — используем matplotlib. "
            "Установите: pip install playwright && playwright install chromium"
        )
        return None

    w = max(256, int(getattr(settings, "GLB_2D_PLAYWRIGHT_VIEWPORT", 1024)))
    h = w
    timeout_ms = int(getattr(settings, "GLB_2D_PLAYWRIGHT_TIMEOUT_MS", 180_000))
    cdn_url = getattr(settings, "GLB_2D_MODEL_VIEWER_SCRIPT_URL", _MV_DEFAULT_CDN)

    # Пробуем отдать model-viewer локально — не нужен интернет на сервере.
    mv_js_path = _get_model_viewer_js()
    fname_glb = f"model.{file_ext}"
    fname_mv = "model-viewer.min.js"
    if mv_js_path and mv_js_path.exists():
        script_tag = f'<script type="module" src="{fname_mv}"></script>'
        use_local_mv = True
    else:
        script_tag = f'<script type="module" src="{cdn_url}"></script>'
        use_local_mv = False

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
{script_tag}
<style>
  html, body {{ margin: 0; padding: 0; background: #ffffff; overflow: hidden; }}
  model-viewer {{ width: {w}px; height: {h}px; display: block; }}
</style>
</head>
<body>
<model-viewer
  id="mv"
  src="{fname_glb}"
  alt=""
  camera-orbit="42deg 72deg 108%"
  shadow-intensity="1"
  exposure="1"
  environment-image="neutral"
  tone-mapping="commerce"
  interaction-prompt="none"
></model-viewer>
</body>
</html>"""

    root = Path(tempfile.mkdtemp(prefix="mvshot_"))
    try:
        (root / fname_glb).write_bytes(glb_bytes)
        (root / "index.html").write_text(html, encoding="utf-8")
        if use_local_mv:
            import shutil
            shutil.copy2(mv_js_path, root / fname_mv)

        handler = _make_static_handler(root)
        server = _ReusableHTTPServer(("127.0.0.1", 0), handler)
        port = server.server_address[1]
        th = threading.Thread(target=server.serve_forever, daemon=True)
        th.start()
        url = f"http://127.0.0.1:{port}/index.html"
        # Сколько секунд ждать рендера после загрузки скрипта.
        # Для тяжёлых GLB (>10 MB) нужно больше.
        glb_mb = len(glb_bytes) / 1_048_576
        render_wait_ms = max(5_000, min(30_000, int(glb_mb * 1_500)))
        script_timeout_ms = min(timeout_ms, 30_000)

        logger.warning(
            "glb_2d: playwright запускается (viewport=%dx%d, glb=%.1fMB, "
            "script_timeout=%ds, render_wait=%ds, local_mv=%s)",
            w, h, glb_mb,
            script_timeout_ms // 1000, render_wait_ms // 1000, use_local_mv,
        )
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        # WebGL через ANGLE + SwiftShader (software, без GPU)
                        "--use-angle=swiftshader",
                        "--enable-webgl",
                        "--ignore-gpu-blocklist",
                        "--disable-gpu",
                        "--disable-gpu-sandbox",
                    ],
                )
                try:
                    page = browser.new_page(viewport={"width": w, "height": h})
                    page.set_default_timeout(timeout_ms)
                    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

                    # Ждём пока model-viewer зарегистрируется как custom element.
                    # wait_for_function имеет нормальный Python-таймаут (не висит).
                    page.wait_for_function(
                        "() => customElements.get('model-viewer') !== undefined",
                        timeout=script_timeout_ms,
                    )
                    logger.warning("glb_2d: model-viewer custom element зарегистрирован")

                    # Ждём фиксированное время — рендер GLB (тяжёлая геометрия).
                    page.wait_for_timeout(render_wait_ms)

                    png = page.locator("model-viewer").screenshot(type="png")
                    logger.warning("glb_2d: playwright успешно, PNG %d байт", len(png))
                    return png
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            th.join(timeout=15.0)
    except Exception as e:
        logger.warning(
            "glb_2d: playwright/model-viewer упал: %s — откат на matplotlib. "
            "Типичные причины: нет WebGL (--use-gl=swiftshader), нет сети до unpkg, "
            "нет chromium (playwright install chromium).",
            e,
        )
        return None
    finally:
        try:
            for child in root.iterdir():
                child.unlink(missing_ok=True)
            root.rmdir()
        except OSError:
            pass


def _url_ok(url: str) -> bool:
    low = url.lower().strip()
    return low.startswith(("http://", "https://", "/"))


def product_lacks_catalog_2d(product: Product) -> bool:
    """True если для карточки 2D нет ни одного источника (как getProductPrimaryImageUrl на фронте)."""
    if product.image:
        return False
    if (product.photo_url or "").strip():
        return False
    if product.images.exists():
        return False
    if product.get_image_assets().exists():
        return False
    return True


def load_primary_glb_bytes(product: Product) -> bytes | None:
    """
    Загрузить байты основной браузерной модели (порядок близок к ProductSerializer.get_model_glb).
    USDZ пропускаем — рендер через matplotlib/trimesh не гарантирован.
    """
    for asset in product.get_3d_model_assets():
        name = (getattr(asset.file, "name", "") or "").lower()
        if not name.endswith((".glb", ".gltf")):
            continue
        try:
            with asset.file.open("rb") as f:
                return f.read()
        except OSError as e:
            logger.warning("glb_2d: не удалось прочитать FileAsset %s: %s", asset.pk, e)
            continue

    mg = (product.model_glb or "").strip()
    if mg and _url_ok(mg) and not is_ephemeral_external_model_url(mg):
        try:
            return _load_file_bytes(mg)
        except Exception as e:
            logger.warning("glb_2d: model_glb load failed: %s", e)

    preview = (product.model_rfa_glb_preview or "").strip()
    if preview and _url_ok(preview):
        try:
            return _load_file_bytes(preview)
        except Exception as e:
            logger.warning("glb_2d: rfa glb preview load failed: %s", e)

    return None


def _infer_load_file_type(data: bytes) -> str:
    head = data.lstrip()[:20]
    if head.startswith(b"{"):
        return "gltf"
    return "glb"


def _scene_to_single_mesh(scene) -> "trimesh.Trimesh":
    import trimesh

    if isinstance(scene, trimesh.Trimesh):
        return scene
    if not isinstance(scene, trimesh.Scene):
        raise ValueError(f"unexpected loaded type: {type(scene)}")
    meshes: list[trimesh.Trimesh] = []
    for g in scene.geometry.values():
        if isinstance(g, trimesh.Trimesh):
            meshes.append(g)
    if not meshes:
        raise ValueError("GLB/GLTF: нет Trimesh-геометрии")
    if len(meshes) == 1:
        return meshes[0]
    # Несколько мешей: merge без визуала — иначе concatenate копирует PIL-текстуры (долго, лишняя память).
    # Цвет превью тогда из освещения + дефолтный тон; геометрия целая.
    bare = tuple(m.copy(include_visual=False) for m in meshes)
    return trimesh.util.concatenate(bare)


def _face_normals_numpy(vtx: "np.ndarray", fc: "np.ndarray") -> "np.ndarray":
    """Единичные нормали граней без scipy / fix_normals."""
    import numpy as np

    v0 = vtx[fc[:, 0]]
    v1 = vtx[fc[:, 1]]
    v2 = vtx[fc[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(fn, axis=1, keepdims=True)
    norms = np.where(norms < 1e-12, 1.0, norms)
    return (fn / norms).astype(np.float64)


def _limit_face_count(mesh: "trimesh.Trimesh", max_faces: int) -> "trimesh.Trimesh":
    import numpy as np
    import trimesh

    n = len(mesh.faces)
    if n <= max_faces:
        return mesh
    rng = np.random.default_rng(42)
    idx = np.sort(rng.choice(n, size=max_faces, replace=False))
    sub = mesh.submesh([idx], only_watertight=False, append=True)
    if isinstance(sub, trimesh.Trimesh):
        return sub
    raise ValueError("submesh не вернул Trimesh")


def _matplotlib_mesh_preview_png(mesh: "trimesh.Trimesh", size: tuple[int, int], dpi: int) -> bytes:
    """
    Запасной рендер без WebGL: освещение + vertex colors / baseColorFactor / diffuse.
    UV-текстуры и PBR не совпадают с model-viewer — при наличии Playwright используется скрин viewer.
    """
    import numpy as np
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    w, h = size
    vtx = np.asarray(mesh.vertices, dtype=np.float64)
    fc = np.asarray(mesh.faces, dtype=np.int64)
    if vtx.size == 0 or fc.size == 0:
        raise ValueError("пустая геометрия")

    fn = _face_normals_numpy(vtx, fc)
    light_dir = np.array([0.48, 0.36, 0.86], dtype=np.float64)
    light_dir = light_dir / max(float(np.linalg.norm(light_dir)), 1e-12)
    ndotl = np.clip(np.sum(fn * light_dir, axis=1), 0.0, 1.0)
    shade = (0.26 + 0.74 * ndotl)[:, np.newaxis]

    n_faces = len(fc)
    base = np.tile(np.array([[0.86, 0.80, 0.74]], dtype=np.float64), (n_faces, 1))

    vis = getattr(mesh, "visual", None)
    if vis is not None:
        try:
            vc = np.asarray(getattr(vis, "vertex_colors", None))
            if vc.size and vc.shape[0] == len(mesh.vertices) and vc.shape[1] >= 3:
                tri_vc = vc[fc][:, :, :3].astype(np.float64) / 255.0
                base = np.clip(tri_vc.mean(axis=1), 0.0, 1.0)
        except Exception:
            pass
        default_tile = np.tile(np.array([[0.86, 0.80, 0.74]], dtype=np.float64), (n_faces, 1))
        if np.allclose(base, default_tile):
            mat = getattr(vis, "material", None)
            if mat is not None:
                bcf = getattr(mat, "baseColorFactor", None)
                if bcf is not None:
                    arr = np.asarray(bcf, dtype=np.float64).ravel()
                    if arr.size >= 3:
                        rgb = np.clip(arr[:3], 0.0, 1.0)
                        base = np.tile(rgb, (n_faces, 1))
                if np.allclose(base, default_tile):
                    for attr in ("main_color", "diffuse", "ambient"):
                        c = getattr(mat, attr, None)
                        if c is None:
                            continue
                        arr = np.asarray(c, dtype=np.float64).ravel()
                        if arr.size >= 3:
                            mx = 255.0 if arr[:3].max() > 1.01 else 1.0
                            rgb = np.clip(arr[:3] / mx, 0.0, 1.0)
                            base = np.tile(rgb, (n_faces, 1))
                            break

    face_rgb = np.clip(base * shade, 0.0, 1.0)
    triangles = vtx[fc]

    fig = plt.figure(figsize=(w / dpi, h / dpi), dpi=dpi, facecolor="white")
    ax = fig.add_subplot(111, projection="3d")
    coll = Poly3DCollection(
        triangles,
        facecolors=face_rgb,
        edgecolors="none",
        linewidths=0,
        antialiased=True,
    )
    ax.add_collection3d(coll)

    ax.view_init(elev=22, azim=42)
    span = float(np.ptp(vtx, axis=0).max())
    if span <= 0:
        span = 1.0
    mid = vtx.mean(axis=0)
    pad = span * 0.52
    ax.set_xlim(mid[0] - pad, mid[0] + pad)
    ax.set_ylim(mid[1] - pad, mid[1] + pad)
    ax.set_zlim(mid[2] - pad, mid[2] + pad)
    ax.set_axis_off()
    plt.subplots_adjust(left=0, right=1, bottom=0, top=1)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor="white", transparent=False)
    plt.close(fig)
    return buf.getvalue()


def _render_with_subprocess(glb_bytes: bytes) -> bytes | None:
    cmd_tmpl = getattr(settings, "GLB_PREVIEW_COMMAND", "").strip()
    if not cmd_tmpl or "{input}" not in cmd_tmpl or "{output}" not in cmd_tmpl:
        return None
    with tempfile.TemporaryDirectory(prefix="glb2png_") as tmp:
        in_path = Path(tmp) / "model.glb"
        out_path = Path(tmp) / "preview.png"
        in_path.write_bytes(glb_bytes)
        cmd = cmd_tmpl.format(input=str(in_path), output=str(out_path))
        subprocess.run(
            _build_command_args(cmd),
            check=True,
            timeout=getattr(settings, "GLB_PREVIEW_COMMAND_TIMEOUT_SEC", 300),
            capture_output=True,
            text=True,
            env={**os.environ, **getattr(settings, "GLB_PREVIEW_COMMAND_ENV", {})},
        )
        if not out_path.is_file():
            return None
        return out_path.read_bytes()


def render_glb_bytes_to_png(glb_bytes: bytes) -> tuple[bytes, str]:
    """
    GLB/GLTF (байты) → (PNG байты, имя рендерера).
    Рендерер: 'subprocess' | 'playwright' | 'matplotlib'
    """
    ext = _infer_load_file_type(glb_bytes)
    try:
        ext_cmd = _render_with_subprocess(glb_bytes)
        if ext_cmd:
            return ext_cmd, "subprocess"
    except subprocess.CalledProcessError as e:
        logger.warning("glb_2d: внешняя команда GLB_PREVIEW_COMMAND завершилась с ошибкой: %s", e)
    except (OSError, subprocess.TimeoutExpired, ValueError) as e:
        logger.warning("glb_2d: внешняя команда не выполнена: %s", e)

    pw = _render_with_playwright_screenshot(glb_bytes, ext)
    if pw:
        return pw, "playwright"

    logger.warning(
        "glb_2d: Playwright не сработал — используем matplotlib (без UV-текстур, качество ниже). "
        "Для нормального качества: pip install playwright && playwright install chromium"
    )

    import importlib.util

    for mod in ("numpy", "trimesh", "matplotlib"):
        if importlib.util.find_spec(mod) is None:
            raise RuntimeError(
                f"Не установлен пакет «{mod}». "
                f"pip install -r requirements.txt"
            )

    import matplotlib

    matplotlib.use("Agg")
    import trimesh

    scene = trimesh.load(
        io.BytesIO(glb_bytes),
        file_type=ext,
        force="scene",
        ignore_broken=True,
    )
    mesh = _scene_to_single_mesh(scene)
    mesh = _limit_face_count(mesh, _MAX_FACES_MATPLOTLIB)

    return _matplotlib_mesh_preview_png(mesh, _PREVIEW_SIZE, dpi=100), "matplotlib"


def _invalidate_product_cache(product_id: int) -> None:
    from django.core.cache import cache

    cache.delete(f"product_detail:{product_id}")
    try:
        cache.delete_pattern("products_list*")
    except AttributeError:
        pass


def run_glb_2d_preview_for_product_id(product_id: int, *, force: bool = False) -> dict:
    """
    Сгенерировать и сохранить product.image из GLB, если нет других фото (или force=True).
    """
    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return {"status": "error", "reason": "no-product"}

    if not getattr(settings, "GLB_2D_PREVIEW_ENABLED", True):
        return {"status": "skipped", "reason": "disabled"}

    if not force and not product_lacks_catalog_2d(product):
        return {"status": "skipped", "reason": "has-2d"}

    raw = load_primary_glb_bytes(product)
    if not raw:
        return {"status": "skipped", "reason": "no-glb"}

    try:
        png, renderer = render_glb_bytes_to_png(raw)
    except Exception as e:
        logger.exception("glb_2d: рендер не удался product_id=%s", product_id)
        return {"status": "error", "reason": f"render-failed: {e}"[:500]}

    name = f"glb2d_{product_id}.png"
    product.image.save(name, ContentFile(png), save=True)
    _invalidate_product_cache(product_id)
    return {"status": "ok", "image": product.image.name, "renderer": renderer}
