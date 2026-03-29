from django.urls import path
from .views import (
    PluginActivateView,
    PluginOfflineActivationView,
    PluginProductListView,
    PluginDownloadView,
    PluginAssetDirectView,
    PluginLegacyLicenseView,
)

urlpatterns = [
    path("plugin/activate/", PluginActivateView.as_view(), name="plugin-activate"),
    path("plugin/offline-activation/", PluginOfflineActivationView.as_view(), name="plugin-offline-activation"),
    # Legacy endpoint for ready-made plugin compatibility
    path("license.php", PluginLegacyLicenseView.as_view(), name="plugin-license-legacy"),
    path("license", PluginLegacyLicenseView.as_view(), name="plugin-license-legacy-no-ext"),
    path("plugin/products/", PluginProductListView.as_view(), name="plugin-products"),
    path("plugin/download/", PluginDownloadView.as_view(), name="plugin-download"),
    # Совместимость с fbx_receiver: GET /api/assets/{fileName}.glb|rfa|rvt
    path("assets/<path:file_path>", PluginAssetDirectView.as_view(), name="plugin-asset-direct"),
]
