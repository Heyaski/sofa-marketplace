from django.test import SimpleTestCase
from unittest.mock import MagicMock, patch

from apps.catalog.catalog_visibility import product_has_catalog_3d_glb
from apps.catalog.product_model_files import product_has_glb


class CatalogVisibilityTests(SimpleTestCase):
    def test_ephemeral_model_glb_not_counted_as_glb(self):
        product = MagicMock()
        product.model_glb = (
            "https://hitem3dstatic.zaohaowu.net/foo.glb?auth_key=abc&t=1"
        )
        product.model_rfa_glb_preview = ""
        product.model_ar_glb = ""
        with patch(
            "apps.catalog.product_model_files.find_glb_assets_for_product",
            return_value=[],
        ):
            self.assertFalse(product_has_glb(product))

    def test_stable_s3_glb_url_visible(self):
        product = MagicMock()
        product.model_glb = (
            "https://s3.ru1.storage.beget.cloud/bucket/assets/Кресло4052.glb"
        )
        product.model_rfa_glb_preview = ""
        product.model_ar_glb = ""
        with patch(
            "apps.catalog.product_model_files.find_glb_assets_for_product",
            return_value=[],
        ), patch(
            "apps.catalog.glb_2d_preview.find_stable_glb_url_for_product",
            return_value=None,
        ), patch(
            "apps.catalog.catalog_visibility.find_glb_assets_for_product",
            return_value=[],
        ):
            self.assertTrue(product_has_glb(product))
            self.assertTrue(product_has_catalog_3d_glb(product))
