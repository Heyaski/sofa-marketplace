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
from django.db.models import Q

from apps.catalog.file_urls import should_replace_product_model_url_with_asset
from apps.catalog.models import FileAsset, Product, ProductImage

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"})
MODEL_EXTENSIONS = frozenset(
    {".glb", ".gltf", ".fbx", ".obj", ".usdz", ".rfa", ".ifc", ".dae", ".3ds"}
)
SKIP_DIR_NAMES = frozenset({"imported", "__macosx"})


def default_incoming_dir() -> str:
    return getattr(settings, "UPLOAD3D_MODELS_INCOMING_DIR", "/home/upload3d/models")


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


def link_article_files_to_product(
    article: str,
    files_data: dict[str, list[FileAsset]],
) -> tuple[bool, list[str]]:
    """Привязать FileAsset к товару по артикулу. Returns (linked, errors)."""
    errors: list[str] = []
    product = Product.objects.filter(article__iexact=article).first()
    if not product and files_data.get("models"):
        first_asset_id = files_data["models"][0].asset_id
        if first_asset_id != article:
            product = Product.objects.filter(article__iexact=first_asset_id).first()
        if not product:
            mid = first_asset_id.strip()
            product = Product.objects.filter(
                Q(model_3d_asset_ids__iexact=mid)
                | Q(model_3d_asset_ids__istartswith=mid + ",")
                | Q(model_3d_asset_ids__iendswith="," + mid)
                | Q(model_3d_asset_ids__icontains="," + mid + ",")
            ).first()
    if not product and files_data.get("images"):
        first_asset_id = files_data["images"][0].asset_id
        if first_asset_id != article:
            product = Product.objects.filter(article__iexact=first_asset_id).first()

    if not product:
        if files_data["images"] or files_data["models"]:
            errors.append(
                f"Товар с артикулом '{article}' не найден. FileAsset создан, привязки нет."
            )
        return False, errors

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

        for asset in files_data["models"]:
            try:
                if asset.file and hasattr(asset.file, "url"):
                    file_ext = os.path.splitext(asset.file.name)[1].lower()
                    file_url = asset.file.url
                    if file_ext == ".glb" and should_replace_product_model_url_with_asset(
                        product.model_glb, file_url
                    ):
                        product.model_glb = file_url
                    elif file_ext == ".fbx" and not product.model_fbx:
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
    return True, errors


def import_directory(
    root_dir: str,
    *,
    dry_run: bool = False,
    move_imported: bool = True,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """
    Обойти каталог (SFTP incoming), загрузить в FileAsset + привязать к товарам.
    """
    root_dir = os.path.abspath(root_dir)
    if not os.path.isdir(root_dir):
        raise FileNotFoundError(f"Каталог не найден: {root_dir}")

    stats: dict[str, Any] = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "products_linked": 0,
        "files_moved": 0,
        "errors": [],
    }
    articles_files: dict[str, dict[str, list[FileAsset]]] = defaultdict(
        lambda: {"images": [], "models": []}
    )
    paths_by_article: dict[str, list[str]] = defaultdict(list)

    imported_name = imported_subdir_name()
    processed = 0

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [
            d
            for d in dirnames
            if d.lower() not in SKIP_DIR_NAMES and not d.startswith(".")
        ]
        if imported_name in dirpath.replace("\\", "/").split("/"):
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

            base_article = extract_base_article(file_asset.asset_id)
            if file_asset.file_type == "image":
                articles_files[base_article]["images"].append(file_asset)
            else:
                articles_files[base_article]["models"].append(file_asset)
            paths_by_article[base_article].append(full_path)

            processed += 1
            if progress and processed % 25 == 0:
                progress(
                    f"  … загружено в S3: {processed} файлов "
                    f"(создано {stats['created']}, обновлено {stats['updated']})"
                )

    if dry_run:
        return stats

    if progress:
        progress(
            f"Привязка к товарам: {len(articles_files)} артикул(ов)…"
        )

    for article, files_data in articles_files.items():
        try:
            linked, errs = link_article_files_to_product(article, files_data)
            stats["errors"].extend(errs)
            if linked:
                stats["products_linked"] += 1
                if move_imported:
                    dest_dir = os.path.join(root_dir, imported_name)
                    os.makedirs(dest_dir, exist_ok=True)
                    for src in paths_by_article[article]:
                        if not os.path.isfile(src):
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

    return stats
