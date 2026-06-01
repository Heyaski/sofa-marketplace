"""
Импорт файлов с диска (каталог SFTP upload3d) — та же логика, что ZIP в админке
/catalog/fileasset/import-files/.
"""
from __future__ import annotations

import os
import re
import shutil
from collections import defaultdict
from typing import Any, Callable

from django.conf import settings
from django.core.files.base import ContentFile

from apps.catalog.asset_matching import find_product_for_file_asset_id
from apps.catalog.file_urls import (
    is_ephemeral_external_model_url,
    should_replace_product_model_url_with_asset,
    url_has_extension,
    url_is_trusted_storage,
    url_looks_like_browser_model_file,
)
from apps.catalog.models import FileAsset, Product, ProductImage

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"})
MODEL_EXTENSIONS = frozenset(
    {".glb", ".gltf", ".fbx", ".obj", ".usdz", ".rfa", ".ifc", ".dae", ".3ds"}
)
SKIP_DIR_NAMES = frozenset({"__macosx"})
# «imported» — архив после импорта; SFTP часто кладёт сюда напрямую — обрабатываем отдельным проходом


def default_incoming_dir() -> str:
    dirs = resolve_upload3d_incoming_dirs()
    return dirs[0] if dirs else "/home/upload3d/models"


def sftp_upload_dir() -> str:
    """Куда класть новые файлы по SFTP (не в imported/ — туда sync переносит после обработки)."""
    base = (getattr(settings, "UPLOAD3D_MODELS_INCOMING_DIR", "/home/upload3d/models") or "").strip()
    sub = (getattr(settings, "UPLOAD3D_SFTP_UPLOAD_SUBDIR", "incoming") or "incoming").strip()
    if not sub:
        return os.path.abspath(base)
    return os.path.abspath(os.path.join(base, sub))


def resolve_upload3d_incoming_dirs() -> list[str]:
    """
    Корни для sync_upload3d_models (обходят корень + подпапку imported/).
    Cursor/скрипты: /home/upload3d/models или chroot /models.
    """
    seen: set[str] = set()
    ordered: list[str] = []

    def add(path: str) -> None:
        ab = os.path.abspath((path or "").strip())
        if not ab or ab in seen:
            return
        seen.add(ab)
        ordered.append(ab)

    add(getattr(settings, "UPLOAD3D_MODELS_INCOMING_DIR", "/home/upload3d/models"))
    add(sftp_upload_dir())
    extra = (getattr(settings, "UPLOAD3D_MODELS_INCOMING_DIRS", None) or "").strip()
    for part in extra.split(","):
        add(part)
    for candidate in ("/home/upload3d/models", "/models"):
        if os.path.isdir(candidate):
            add(candidate)
    return ordered


def _file_already_in_imported_subdir(file_path: str, root_dir: str) -> bool:
    imported_name = imported_subdir_name()
    try:
        rel = os.path.relpath(os.path.abspath(file_path), os.path.abspath(root_dir))
    except ValueError:
        return False
    parts = rel.replace("\\", "/").split("/")
    return bool(parts) and parts[0] == imported_name


def imported_subdir_name() -> str:
    return getattr(settings, "UPLOAD3D_MODELS_IMPORTED_SUBDIR", "imported")


def extract_base_article(asset_id: str) -> str:
    """IMR-556065(1) -> IMR-556065, IMR-1284569WHT -> IMR-1284569."""
    if not asset_id:
        return ""
    s = asset_id.strip()
    if "(" in s:
        return s.split("(")[0].strip()
    m = re.match(r"^(.+)([A-Z]{2,4})$", s.upper())
    if m and len(m.group(1)) >= 4:
        return m.group(1)
    return s


def _file_type_for_ext(ext: str) -> str | None:
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in MODEL_EXTENSIONS:
        return "3d_model"
    return None


def upsert_fileasset_from_path(full_path: str, filename: str) -> tuple[FileAsset | None, str]:
    """
    Создать/обновить FileAsset с диска.
    Returns (file_asset, status) status: created|updated|skipped
    """
    file_ext = os.path.splitext(filename)[1].lower()
    file_type = _file_type_for_ext(file_ext)
    if not file_type:
        return None, "skipped"

    asset_id = os.path.splitext(filename)[0]
    existing = FileAsset.objects.filter(asset_id=asset_id, file_type=file_type).first()
    file_size = os.path.getsize(full_path)
    save_filename = filename

    if file_size > 50 * 1024 * 1024:
        with open(full_path, "rb") as f:
            if existing:
                existing.file.save(save_filename, f, save=True)
                return existing, "updated"
            file_asset = FileAsset(asset_id=asset_id, file_type=file_type, description="")
            file_asset.file.save(save_filename, f, save=True)
            return file_asset, "created"

    with open(full_path, "rb") as f:
        file_content = f.read()
    if existing:
        existing.file.save(save_filename, ContentFile(file_content), save=True)
        return existing, "updated"
    file_asset = FileAsset(asset_id=asset_id, file_type=file_type, description="")
    file_asset.file.save(save_filename, ContentFile(file_content), save=True)
    return file_asset, "created"


def fix_misplaced_model_urls_from_excel(product: Product) -> bool:
    """
    Excel/inmyroom часто кладёт FBX-URL в model_glb. Переносим в model_fbx и очищаем model_glb.
    """
    changed = False
    mg = (product.model_glb or "").strip()
    if mg and url_has_extension(mg, ".fbx") and not url_looks_like_browser_model_file(mg):
        if not (product.model_fbx or "").strip():
            product.model_fbx = mg
        product.model_glb = ""
        changed = True
    return changed


def link_article_files_to_product(
    article: str,
    files_data: dict[str, list[FileAsset]],
) -> tuple[bool, list[str], int | None]:
    """Привязать FileAsset к товару. Returns (linked, errors, product_pk)."""
    errors: list[str] = []
    product = find_product_for_file_asset_id(article)
    if not product:
        for asset in files_data.get("models", []) + files_data.get("images", []):
            product = find_product_for_file_asset_id(asset.asset_id)
            if product:
                break

    if not product:
        if files_data["images"] or files_data["models"]:
            errors.append(
                f"Товар с артикулом '{article}' не найден. FileAsset создан, привязки нет."
            )
        return False, errors, None

    if files_data["images"]:
        sorted_images = sorted(files_data["images"], key=lambda x: x.asset_id)
        image_asset_ids = [asset.asset_id for asset in sorted_images]
        existing_ids = product.image_asset_ids.split(",") if product.image_asset_ids else []
        existing_ids = [i.strip() for i in existing_ids if i.strip()]
        product.image_asset_ids = ",".join(set(existing_ids + image_asset_ids))

        for order, asset in enumerate(sorted_images, start=0):
            try:
                existing_image = product.images.filter(
                    image__icontains=os.path.basename(asset.file.name)
                ).first()
                if not existing_image and asset.file:
                    asset.file.open("rb")
                    file_content = asset.file.read()
                    asset.file.close()
                    product_image = ProductImage(product=product, order=order)
                    fn = os.path.basename(asset.file.name)
                    product_image.image.save(fn, ContentFile(file_content), save=True)
            except Exception as e:
                errors.append(f"ProductImage '{article}': {e}")

    if files_data["models"]:
        model_asset_ids = [asset.asset_id for asset in files_data["models"]]
        existing_model_ids = product.model_3d_asset_ids.split(",") if product.model_3d_asset_ids else []
        existing_model_ids = [i.strip() for i in existing_model_ids if i.strip()]
        product.model_3d_asset_ids = ",".join(set(existing_model_ids + model_asset_ids))

        fix_misplaced_model_urls_from_excel(product)

        for asset in files_data["models"]:
            try:
                if asset.file and hasattr(asset.file, "url"):
                    file_ext = os.path.splitext(asset.file.name)[1].lower()
                    file_url = asset.file.url
                    if file_ext == ".glb" and (
                        should_replace_product_model_url_with_asset(product.model_glb, file_url)
                        or url_is_trusted_storage(file_url)
                    ):
                        product.model_glb = file_url
                        if is_ephemeral_external_model_url(product.model_fbx):
                            product.model_fbx = ""
                    elif file_ext == ".fbx" and (
                        not (product.model_fbx or "").strip()
                        or is_ephemeral_external_model_url(product.model_fbx)
                    ):
                        product.model_fbx = file_url
                    elif file_ext == ".usdz" and not product.model_usdz:
                        product.model_usdz = file_url
                    elif file_ext == ".rfa" and not product.model_rfa:
                        product.model_rfa = file_url
                    elif file_ext == ".ifc" and not product.model_ifc:
                        product.model_ifc = file_url
            except Exception:
                pass

    product.save(
        update_fields=[
            "image_asset_ids",
            "model_3d_asset_ids",
            "model_glb",
            "model_fbx",
            "model_usdz",
            "model_rfa",
            "model_ifc",
        ]
    )
    from apps.catalog.catalog_asset_publish import apply_model_urls_from_assets

    apply_model_urls_from_assets(product)
    return True, errors, product.pk


def _scan_tree_into_batch(
    scan_root: str,
    catalog_root: str,
    *,
    skip_imported_subtree: bool,
    dry_run: bool,
    stats: dict[str, Any],
    articles_files: dict[str, dict[str, list[FileAsset]]],
    paths_by_article: dict[str, list[str]],
    progress: Callable[[str], None] | None,
    processed_counter: list[int],
) -> None:
    """Собрать файлы с диска в batch для link_article_files_to_product."""
    imported_name = imported_subdir_name()
    for dirpath, dirnames, filenames in os.walk(scan_root):
        pruned = []
        for d in dirnames:
            if d.startswith("."):
                continue
            if d.lower() in SKIP_DIR_NAMES:
                continue
            if skip_imported_subtree and d.lower() == imported_name:
                continue
            pruned.append(d)
        dirnames[:] = pruned

        norm = dirpath.replace("\\", "/").split("/")
        if skip_imported_subtree and imported_name in norm:
            continue

        for filename in filenames:
            if filename.startswith("."):
                continue
            full_path = os.path.join(dirpath, filename)
            if not os.path.isfile(full_path):
                continue

            file_ext = os.path.splitext(filename)[1].lower()
            if _file_type_for_ext(file_ext) is None:
                stats["skipped"] += 1
                continue

            if dry_run:
                base = extract_base_article(os.path.splitext(filename)[0])
                stats.setdefault("dry_run_files", []).append((filename, base))
                continue

            try:
                file_asset, status = upsert_fileasset_from_path(full_path, filename)
            except Exception as e:
                stats["errors"].append(f"{filename}: {e}")
                continue

            if file_asset is None:
                stats["skipped"] += 1
                continue

            if status == "created":
                stats["created"] += 1
            elif status == "updated":
                stats["updated"] += 1

            group_key = (file_asset.asset_id or "").strip()
            if file_asset.file_type == "image":
                articles_files[group_key]["images"].append(file_asset)
            else:
                articles_files[group_key]["models"].append(file_asset)
            paths_by_article[group_key].append(full_path)

            processed_counter[0] += 1
            if progress and processed_counter[0] % 25 == 0:
                progress(
                    f"  … загружено в S3: {processed_counter[0]} файлов "
                    f"(создано {stats['created']}, обновлено {stats['updated']})"
                )


def import_directory(
    root_dir: str,
    *,
    dry_run: bool = False,
    move_imported: bool = True,
    progress: Callable[[str], None] | None = None,
    scan_imported_subdir: bool = True,
) -> dict[str, Any]:
    """
    Обойти каталог SFTP: корень + (опционально) imported/, куда часто кладут файлы с SFTP.
    """
    root_dir = os.path.abspath(root_dir)
    if not os.path.isdir(root_dir):
        raise FileNotFoundError(f"Каталог не найден: {root_dir}")

    stats: dict[str, Any] = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "products_linked": 0,
        "linked_product_ids": [],
        "files_moved": 0,
        "errors": [],
    }
    articles_files: dict[str, dict[str, list[FileAsset]]] = defaultdict(
        lambda: {"images": [], "models": []}
    )
    paths_by_article: dict[str, list[str]] = defaultdict(list)
    imported_name = imported_subdir_name()
    processed_counter = [0]

    _scan_tree_into_batch(
        root_dir,
        root_dir,
        skip_imported_subtree=True,
        dry_run=dry_run,
        stats=stats,
        articles_files=articles_files,
        paths_by_article=paths_by_article,
        progress=progress,
        processed_counter=processed_counter,
    )
    imported_path = os.path.join(root_dir, imported_name)
    if scan_imported_subdir and os.path.isdir(imported_path):
        if progress:
            progress(f"Сканирование SFTP-архива: {imported_path}")
        _scan_tree_into_batch(
            imported_path,
            root_dir,
            skip_imported_subtree=False,
            dry_run=dry_run,
            stats=stats,
            articles_files=articles_files,
            paths_by_article=paths_by_article,
            progress=progress,
            processed_counter=processed_counter,
        )

    if dry_run:
        return stats

    if progress:
        progress(
            f"Привязка к товарам: {len(articles_files)} артикул(ов)…"
        )

    for article, files_data in articles_files.items():
        try:
            linked, errs, product_pk = link_article_files_to_product(article, files_data)
            stats["errors"].extend(errs)
            if linked:
                stats["products_linked"] += 1
                if product_pk:
                    stats["linked_product_ids"].append(product_pk)
                if move_imported:
                    dest_dir = os.path.join(root_dir, imported_name)
                    os.makedirs(dest_dir, exist_ok=True)
                    for src in paths_by_article[article]:
                        if not os.path.isfile(src):
                            continue
                        if _file_already_in_imported_subdir(src, root_dir):
                            continue
                        dest = os.path.join(dest_dir, os.path.basename(src))
                        if os.path.abspath(src) == os.path.abspath(dest):
                            continue
                        try:
                            if os.path.exists(dest):
                                os.remove(dest)
                            shutil.move(src, dest)
                            stats["files_moved"] += 1
                        except Exception as e:
                            stats["errors"].append(f"move {src}: {e}")
        except Exception as e:
            stats["errors"].append(f"Привязка '{article}': {e}")

    linked = stats.get("linked_product_ids") or []
    if linked:
        stats.update(finalize_imported_products(linked))

    return stats


def finalize_imported_products(product_ids: list[int]) -> dict[str, int]:
    """
    После импорта (SFTP или ZIP в админке): backfill URL, флаги витрины, 2D, RFA→GLB.
    """
    if not product_ids:
        return {}
    from apps.catalog.catalog_asset_publish import (
        backfill_queryset,
        enqueue_rfa_glb_previews,
    )
    from apps.catalog.catalog_visibility import bulk_refresh_catalog_visibility_flags
    from apps.catalog.glb_2d_preview import queue_glb_2d_previews_for_product_ids
    from apps.catalog.models import Product

    unique_ids = list(dict.fromkeys(product_ids))
    qs = Product.objects.filter(pk__in=unique_ids, is_active=True)
    updated, _ = backfill_queryset(qs)
    vis_stats = bulk_refresh_catalog_visibility_flags(Product.objects.filter(pk__in=unique_ids))
    queued_2d = queue_glb_2d_previews_for_product_ids(unique_ids)
    rfa_queued = enqueue_rfa_glb_previews(qs)
    return {
        "backfill_updated": updated,
        "visibility_refreshed": vis_stats.get("visible_3d_set", 0) + vis_stats.get("visible_3d_cleared", 0),
        "queued_2d_previews": queued_2d,
        "rfa_glb_queued": rfa_queued,
    }
