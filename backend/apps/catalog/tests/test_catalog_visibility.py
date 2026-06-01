from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.catalog.catalog_visibility import product_has_catalog_3d_glb
from apps.catalog.product_model_files import product_has_fbx, product_has_glb


class CatalogVisibilityTests(SimpleTestCase):
    def test_ephemeral_fbx_not_counted(self):
        product = MagicMock()
        product.pk = 1
        product.model_fbx = "https://hitem3dstatic.zaohaowu.net/foo.fbx?auth_key=abc"
        product.model_glb = ""
        with patch(
            "apps.catalog.catalog_glb_q.product_matches_catalog_has_glb_q",
            return_value=False,
        ):
            self.assertFalse(product_has_fbx(product))

    def test_glb_uses_catalog_has_glb_q(self):
        product = MagicMock()
        product.pk = 42
        with patch(
            "apps.catalog.catalog_glb_q.product_matches_catalog_has_glb_q",
            return_value=True,
        ) as m:
            self.assertTrue(product_has_glb(product))
            m.assert_called_once_with(product)

    def test_catalog_3d_same_as_glb_badge(self):
        product = MagicMock()
        product.pk = 7
        with patch(
            "apps.catalog.catalog_glb_q.product_matches_catalog_has_glb_q",
            return_value=False,
        ):
            self.assertFalse(product_has_catalog_3d_glb(product))
