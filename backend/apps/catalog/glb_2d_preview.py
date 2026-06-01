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
from collections.abc import Callable, Iterable
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile

from apps.catalog.file_urls import is_ephemeral_external_model_url
from apps.catalog.models import Product


def _exclude_ephemeral_url_field_q(field_name: str) -> "Q":
    """SQL-фильтр: не считать протухшие CDN-ссылки за «есть GLB в БД»."""
    from django.db.models import Q

    blocked = Q()
    for fragment in (
        "auth_key=",
        "zaohaowu",
        "zaonaowu",
        "hitem3dstatic",
        "volcengine.com",
        "volccdn.com",
    ):
        blocked |= Q(**{f"{field_name}__icontains": fragment})
    return ~blocked
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


_CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-gpu",
    "--disable-gpu-sandbox",
]


def _build_mv_html(w: int, script_tag: str, fname_glb: str) -> str:
    return (
        "<!DOCTYPE html><html lang='ru'><head><meta charset='utf-8'/>"
        f"<meta name='viewport' content='width=device-width,initial-scale=1'/>"
        f"{script_tag}"
        f"<style>html,body{{margin:0;padding:0;background:#fff;overflow:hidden}}"
        f"model-viewer{{width:{w}px;height:{w}px;display:block}}</style></head><body>"
        f"<model-viewer id='mv' src='{fname_glb}' alt='' "
        f"camera-orbit='42deg 72deg 108%' shadow-intensity='1' exposure='1' "
        f"environment-image='neutral' tone-mapping='commerce' "
        f"interaction-prompt='none'></model-viewer></body></html>"
    )


class PlaywrightSession:
    """
    Один браузер + один HTTP-сервер на весь пакетный прогон.
    Сохраняет ~3-5с на старт Chromium для каждого продукта.

    Использование:
        with PlaywrightSession() as sess:
            for glb_bytes, ext in items:
                png = sess.render(glb_bytes, ext)
    """

    def __init__(self):
        self._w = max(256, int(getattr(settings, "GLB_2D_PLAYWRIGHT_VIEWPORT", 1024)))
        self._timeout_ms = int(getattr(settings, "GLB_2D_PLAYWRIGHT_TIMEOUT_MS", 180_000))
        self._script_timeout_ms = min(self._timeout_ms, 30_000)
        cdn_url = getattr(settings, "GLB_2D_MODEL_VIEWER_SCRIPT_URL", _MV_DEFAULT_CDN)
        mv_js_path = _get_model_viewer_js()
        self._root = Path(tempfile.mkdtemp(prefix="mvbatch_"))
        fname_mv = "model-viewer.min.js"
        if mv_js_path and mv_js_path.exists():
            import shutil
            shutil.copy2(mv_js_path, self._root / fname_mv)
            self._script_tag = f"<script type='module' src='{fname_mv}'></script>"
            logger.warning("glb_2d: PlaywrightSession — local model-viewer.js")
        else:
            self._script_tag = f"<script type='module' src='{cdn_url}'></script>"
            logger.warning("glb_2d: PlaywrightSession — CDN %s", cdn_url)
        self._server: _ReusableHTTPServer | None = None
        self._server_thread: threading.Thread | None = None
        self._port: int = 0
        self._pw = None
        self._browser = None

    def __enter__(self) -> "PlaywrightSession":
        from playwright.sync_api import sync_playwright
        handler = _make_static_handler(self._root)
        self._server = _ReusableHTTPServer(("127.0.0.1", 0), handler)
        self._port = self._server.server_address[1]
        self._server_thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._server_thread.start()
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True, args=_CHROMIUM_ARGS)
        logger.warning("glb_2d: PlaywrightSession запущен (port=%d)", self._port)
        return self

    def render(self, glb_bytes: bytes, file_ext: str) -> bytes:
        """Рендер одного GLB → PNG bytes. Браузер остаётся открытым."""
        import uuid
        token = uuid.uuid4().hex[:10]
        fname_glb = f"g{token}.{file_ext}"
        fname_html = f"g{token}.html"
        glb_path = self._root / fname_glb
        html_path = self._root / fname_html
        try:
            glb_path.write_bytes(glb_bytes)
            html_path.write_text(
                _build_mv_html(self._w, self._script_tag, fname_glb),
                encoding="utf-8",
            )
            url = f"http://127.0.0.1:{self._port}/{fname_html}"
            page = self._browser.new_page(viewport={"width": self._w, "height": self._w})
            page.set_default_timeout(self._timeout_ms)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=self._timeout_ms)
                # Ждём регистрацию custom element (полл каждые 100ms, с таймаутом)
                page.wait_for_function(
                    "() => customElements.get('model-viewer') !== undefined",
                    timeout=self._script_timeout_ms,
                )
                # Ждём реальную загрузку GLB (el.loaded == true или ошибка)
                page.wait_for_function(
                    "() => { const el = document.getElementById('mv'); "
                    "return el && (el.loaded || el.modelError !== undefined); }",
                    timeout=self._timeout_ms,
                )
                page.wait_for_timeout(300)
                return page.locator("#mv").screenshot(type="png")
            finally:
                page.close()
        finally:
            glb_path.unlink(missing_ok=True)
            html_path.unlink(missing_ok=True)

    def __exit__(self, *_):
        for fn, attr in [
            (lambda: self._browser.close(), "_browser"),
            (lambda: self._pw.stop(), "_pw"),
            (lambda: (self._server.shutdown(), self._server.server_close()), "_server"),
        ]:
            try:
                if getattr(self, attr):
                    fn()
            except Exception:
                pass
        if self._server_thread:
            self._server_thread.join(timeout=10.0)
        try:
            for child in self._root.iterdir():
                child.unlink(missing_ok=True)
            self._root.rmdir()
        except OSError:
            pass


def _render_with_playwright_screenshot(glb_bytes: bytes, file_ext: str) -> bytes | None:
    """Однократный рендер. Для пакетной обработки используй PlaywrightSession."""
    if not getattr(settings, "GLB_2D_USE_PLAYWRIGHT", True):
        return None
    try:
        import playwright  # noqa: F401
    except ImportError:
        logger.info("glb_2d: playwright не установлен. pip install playwright && playwright install chromium")
        return None
    try:
        with PlaywrightSession() as sess:
            png = sess.render(glb_bytes, file_ext)
            logger.warning("glb_2d: playwright OK, PNG %d байт", len(png))
            return png
    except Exception as e:
        logger.warning("glb_2d: playwright упал: %s — откат на matplotlib.", e)
        return None


def _url_ok(url: str) -> bool:
    low = url.lower().strip()
    return low.startswith(("http://", "https://", "/"))


def products_with_browser_glb_queryset():
    """
    Товары, у которых есть GLB/GLTF (поле URL или FileAsset) — только SQL, без скачивания файлов.
    """
    from django.db.models import Q, Exists, OuterRef, Value
    from django.db.models.functions import Concat
    from apps.catalog.models import FileAsset

    glb_ext_q = Q(file__iendswith=".glb") | Q(file__iendswith=".gltf")
    has_glb_asset_by_model_id_q = Exists(
        FileAsset.objects.filter(file_type="3d_model")
        .filter(glb_ext_q)
        .filter(
            Q(asset_id__iexact=OuterRef("model_3d_asset_ids"))
            | Q(asset_id__istartswith=Concat(OuterRef("model_3d_asset_ids"), Value("_")))
            | Q(asset_id__istartswith=Concat(OuterRef("model_3d_asset_ids"), Value("-")))
        )
    )
    has_direct_glb_url_q = (
        (
            Q(model_glb__startswith="http://")
            | Q(model_glb__startswith="https://")
            | Q(model_glb__startswith="/")
        )
        & ~Q(model_glb="")
        & _exclude_ephemeral_url_field_q("model_glb")
    ) | (
        (
            Q(model_rfa_glb_preview__startswith="http://")
            | Q(model_rfa_glb_preview__startswith="https://")
            | Q(model_rfa_glb_preview__startswith="/")
        )
        & ~Q(model_rfa_glb_preview="")
        & _exclude_ephemeral_url_field_q("model_rfa_glb_preview")
    )
    has_glb_via_article_q = (
        Q(article__isnull=False)
        & ~Q(article="")
        & Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .filter(
                Q(asset_id__iexact=OuterRef("article"))
                | Q(asset_id__istartswith=Concat(OuterRef("article"), Value("_")))
                | Q(asset_id__istartswith=Concat(OuterRef("article"), Value("-")))
            )
        )
    )
    has_glb_q = has_direct_glb_url_q | has_glb_asset_by_model_id_q | has_glb_via_article_q
    return Product.objects.filter(has_glb_q)


def find_stable_glb_url_for_product(product: Product) -> str | None:
    """Стабильный URL GLB из FileAsset (S3) или preview после RFA — для backfill model_glb."""
    for asset in product.get_3d_model_assets():
        name = (getattr(asset.file, "name", "") or "").lower()
        if not name.endswith((".glb", ".gltf")):
            continue
        if asset.file:
            url = (asset.file.url or "").strip()
            if url and not is_ephemeral_external_model_url(url):
                return url
    preview = (product.model_rfa_glb_preview or "").strip()
    if preview and _url_ok(preview) and not is_ephemeral_external_model_url(preview):
        return preview
    return None


def product_has_glb_source(product: Product) -> bool:
    """Есть ли источник GLB/GLTF без скачивания (для отбора товаров в management command)."""
    if find_stable_glb_url_for_product(product):
        return True
    mg = (product.model_glb or "").strip()
    if mg and _url_ok(mg) and not is_ephemeral_external_model_url(mg):
        return True
    return False


def _is_usable_http_photo_url(url: str | None) -> bool:
    """Импорт из Excel часто кладёт артикул (Пуф1510), а не URL — это не фото для 2D."""
    u = (url or "").strip()
    return u.startswith(("http://", "https://"))


def collect_catalog_2d_stats(*, active_only: bool = True) -> dict:
    """
    Сводка для 2D-каталога: сколько товаров с фото, сколько ждут PNG из GLB, сколько без GLB.
    """
    qs = Product.objects.filter(is_active=True) if active_only else Product.objects.all()
    total = qs.count()
    glb_ids = set(
        products_with_browser_glb_queryset()
        .filter(is_active=True)
        .values_list("pk", flat=True)
    )
    with_2d = 0
    needs_png_from_glb = 0
    glb_sql_not_loadable = 0
    no_glb_no_2d = 0

    for product in qs.prefetch_related("images").iterator(chunk_size=300):
        if not product_lacks_catalog_2d(product):
            with_2d += 1
            continue
        if product.pk in glb_ids:
            if product_has_glb_source(product):
                needs_png_from_glb += 1
            else:
                glb_sql_not_loadable += 1
        else:
            no_glb_no_2d += 1

    return {
        "total_active": total,
        "with_2d_image": with_2d,
        "needs_png_from_glb": needs_png_from_glb,
        "glb_sql_not_loadable": glb_sql_not_loadable,
        "no_glb_no_2d": no_glb_no_2d,
        "with_glb_in_db": len(glb_ids),
    }


def product_lacks_catalog_2d(product: Product) -> bool:
    """True если для режима 2D каталога нет glb2d PNG и нет нормального http-фото."""
    if product.image and getattr(product.image, "name", None):
        return False
    if _is_usable_http_photo_url(product.photo_url):
        return False
    for row in product.images.all():
        if row.image and getattr(row.image, "name", None):
            return False
    for asset in product.get_image_assets():
        if asset.file and getattr(asset.file, "name", None):
            return False
    return True


def maybe_queue_glb_2d_preview(product: Product) -> bool:
    """
    Поставить Celery-задачу на PNG из GLB, если товару не хватает 2D-превью.
    Вызывается из signals, импорта файлов и backfill model_glb.
    """
    if not getattr(settings, "GLB_2D_PREVIEW_ENABLED", True):
        return False
    if not getattr(settings, "GLB_2D_PREVIEW_AUTO_QUEUE", True):
        return False
    if not product_lacks_catalog_2d(product):
        return False
    if not load_primary_glb_bytes(product):
        return False
    from apps.catalog.tasks import generate_glb_2d_preview_task

    generate_glb_2d_preview_task.delay(product.pk)
    return True


def queue_glb_2d_previews_for_product_ids(product_ids: Iterable[int]) -> int:
    """После импорта/SFTP — Celery-очередь для товаров без 2D (если sync не сделал PNG)."""
    queued = 0
    seen: set[int] = set()
    for pk in product_ids:
        if not pk or pk in seen:
            continue
        seen.add(pk)
        product = Product.objects.filter(pk=pk).first()
        if product and maybe_queue_glb_2d_preview(product):
            queued += 1
    return queued


def generate_2d_previews_for_product_ids(
    product_ids: Iterable[int],
    *,
    progress: Callable[[str], None] | None = None,
) -> dict[str, int]:
    """
    PNG из GLB сразу при импорте (SFTP/ZIP), без ожидания Celery.
    До GLB_2D_PREVIEW_SYNC_ON_IMPORT_MAX товаров — синхронно; остальные — в Celery.
    """
    unique_ids = list(dict.fromkeys(pk for pk in product_ids if pk))
    if not unique_ids or not getattr(settings, "GLB_2D_PREVIEW_ENABLED", True):
        return {"synced_2d": 0, "queued_2d": 0, "skipped_2d": 0}

    use_sync = getattr(settings, "GLB_2D_PREVIEW_SYNC_ON_IMPORT", True)
    sync_max = max(1, int(getattr(settings, "GLB_2D_PREVIEW_SYNC_ON_IMPORT_MAX", 30)))
    synced = queued = skipped = 0

    for idx, pk in enumerate(unique_ids):
        product = Product.objects.filter(pk=pk).first()
        if not product:
            skipped += 1
            continue
        if not product_lacks_catalog_2d(product):
            skipped += 1
            continue
        if use_sync and idx < sync_max:
            if progress:
                progress(f"  2D-превью (сразу): {product.title or pk}…")
            result = run_glb_2d_preview_for_product_id(pk)
            if result.get("status") == "ok":
                synced += 1
                continue
            if result.get("status") == "skipped" and result.get("reason") == "has-2d":
                skipped += 1
                continue
            if progress:
                progress(
                    f"  ⚠ 2D sync не удался ({result.get('reason', '?')}), "
                    f"пробуем Celery…"
                )
        if maybe_queue_glb_2d_preview(product):
            queued += 1
        else:
            skipped += 1

    return {"synced_2d": synced, "queued_2d": queued, "skipped_2d": skipped}


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
    from apps.catalog.catalog_visibility import refresh_product_visibility_flags

    refresh_product_visibility_flags(product, save=True)
    _invalidate_product_cache(product_id)
    return {"status": "ok", "image": product.image.name, "renderer": renderer}
