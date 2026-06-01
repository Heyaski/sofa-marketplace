"""Единый SQL-Q: есть ли у товара GLB (витрина + админка — счётчики, фильтры, списки)."""
from __future__ import annotations

from django.db import connection, models
from django.db.models.expressions import RawSQL
from django.db.models.functions import Concat

from apps.catalog.glb_2d_preview import _exclude_ephemeral_url_field_q
from apps.catalog.models import FileAsset, Product


def _glb_path_in_url_field_q(field_name: str) -> models.Q:
    return models.Q(**{f"{field_name}__iregex": r"\.(glb|gltf|usdz)(\?|$)"}) | models.Q(
        **{f"{field_name}__icontains": ".glb?"}
    )


def catalog_has_glb_q() -> models.Q:
    """
    Товар с браузерным GLB: стабильный URL .glb/.gltf/.usdz или FileAsset на S3.
    Не считать: пустой model_glb, код из Excel без файла, .fbx/.rfa в model_glb, zaohaowu.
    """
    glb_ext_q = (
        models.Q(file__iendswith=".glb")
        | models.Q(file__iendswith=".gltf")
        | models.Q(file__iendswith=".usdz")
    )
    has_glb_asset_by_model_id_q = models.Exists(
        FileAsset.objects.filter(file_type="3d_model")
        .filter(glb_ext_q)
        .filter(
            models.Q(asset_id__iexact=models.OuterRef("model_3d_asset_ids"))
            | models.Q(
                asset_id__istartswith=Concat(
                    models.OuterRef("model_3d_asset_ids"), models.Value("_")
                )
            )
            | models.Q(
                asset_id__istartswith=Concat(
                    models.OuterRef("model_3d_asset_ids"), models.Value("-")
                )
            )
        )
    )
    has_direct_glb_url_q = (
        (
            models.Q(model_glb__startswith="http://")
            | models.Q(model_glb__startswith="https://")
            | models.Q(model_glb__startswith="/")
        )
        & ~models.Q(model_glb="")
        & _glb_path_in_url_field_q("model_glb")
        & _exclude_ephemeral_url_field_q("model_glb")
    ) | (
        (
            models.Q(model_rfa_glb_preview__startswith="http://")
            | models.Q(model_rfa_glb_preview__startswith="https://")
            | models.Q(model_rfa_glb_preview__startswith="/")
        )
        & ~models.Q(model_rfa_glb_preview="")
        & _glb_path_in_url_field_q("model_rfa_glb_preview")
        & _exclude_ephemeral_url_field_q("model_rfa_glb_preview")
    )
    has_glb_via_article_q = (
        models.Q(article__isnull=False)
        & ~models.Q(article="")
        & models.Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .filter(
                models.Q(asset_id__iexact=models.OuterRef("article"))
                | models.Q(
                    asset_id__istartswith=Concat(models.OuterRef("article"), models.Value("_"))
                )
                | models.Q(
                    asset_id__istartswith=Concat(models.OuterRef("article"), models.Value("-"))
                )
            )
        )
    )
    has_glb_model_glb_code_q = (
        models.Q(model_glb__isnull=False)
        & ~models.Q(model_glb="")
        & ~models.Q(model_glb__startswith="http://")
        & ~models.Q(model_glb__startswith="https://")
        & ~models.Q(model_glb__startswith="/")
        & models.Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .filter(
                models.Q(asset_id__iexact=models.OuterRef("model_glb"))
                | models.Q(
                    asset_id__istartswith=Concat(models.OuterRef("model_glb"), models.Value("_"))
                )
                | models.Q(
                    asset_id__istartswith=Concat(models.OuterRef("model_glb"), models.Value("-"))
                )
            )
        )
    )
    has_glb_in_csv_model_ids_q = models.Q()
    has_glb_via_article_prefix_q = models.Q()
    if connection.vendor == "postgresql":
        asset_table = FileAsset._meta.db_table
        product_table = Product._meta.db_table
        has_glb_in_csv_model_ids_q = models.Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .extra(
                where=[
                    f"POSITION(',' || LOWER({asset_table}.asset_id) || ',' IN "
                    f"',' || LOWER(REPLACE(COALESCE({product_table}.model_3d_asset_ids, ''), ' ', '')) || ',') > 0"
                ]
            )
        )
        has_glb_via_article_prefix_q = models.Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .annotate(
                _article_prefix=RawSQL(
                    f"CASE WHEN LENGTH({asset_table}.asset_id) >= 4 "
                    f"AND LEFT(LOWER(%s), LENGTH({asset_table}.asset_id)) = LOWER({asset_table}.asset_id) "
                    f"THEN 1 ELSE 0 END",
                    [models.OuterRef("article")],
                )
            )
            .filter(_article_prefix=1)
        )
    has_glb_via_title_q = models.Q()
    if connection.vendor == "postgresql":
        asset_table = FileAsset._meta.db_table
        has_glb_via_title_q = models.Exists(
            FileAsset.objects.filter(file_type="3d_model")
            .filter(glb_ext_q)
            .annotate(
                _title_match=RawSQL(
                    f"CASE WHEN LENGTH({asset_table}.asset_id) >= 4 "
                    f"AND {asset_table}.asset_id ~ '[0-9]' "
                    f"AND POSITION(LOWER({asset_table}.asset_id) IN LOWER(%s)) > 0 "
                    f"THEN 1 ELSE 0 END",
                    [models.OuterRef("title")],
                )
            )
            .filter(_title_match=1)
        )
    return (
        has_direct_glb_url_q
        | has_glb_asset_by_model_id_q
        | has_glb_in_csv_model_ids_q
        | has_glb_model_glb_code_q
        | has_glb_via_article_q
        | has_glb_via_article_prefix_q
        | has_glb_via_title_q
    )


def product_matches_catalog_has_glb_q(product: Product) -> bool:
    """Тот же критерий, что SQL catalog_has_glb_q() — для бейджей без расхождений."""
    if not product.pk:
        return False
    return Product.objects.filter(pk=product.pk).filter(catalog_has_glb_q()).exists()
