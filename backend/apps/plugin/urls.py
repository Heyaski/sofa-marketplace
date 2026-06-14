from django.urls import path
from .views import (
    PluginActivateView,
    PluginActivateByTokenView,
    PluginOfflineActivationView,
    PluginProductListView,
    PluginDownloadView,
    PluginAssetDirectView,
    PluginLegacyLicenseView,
    PluginResendActivationEmailView,
    PluginPlatformsView,
    MobileAppInfoView,
)

urlpatterns = [
    path("plugin/activate/", PluginActivateView.as_view(), name="plugin-activate"),
    path("plugin/activate-by-token/", PluginActivateByTokenView.as_view(), name="plugin-activate-by-token"),
    path("plugin/platforms/", PluginPlatformsView.as_view(), name="plugin-platforms"),
    path("plugin/offline-activation/", PluginOfflineActivationView.as_view(), name="plugin-offline-activation"),
    # Legacy endpoint for ready-made plugin compatibility
    path("license.php", PluginLegacyLicenseView.as_view(), name="plugin-license-legacy"),
    path("license", PluginLegacyLicenseView.as_view(), name="plugin-license-legacy-no-ext"),
    path("plugin/products/", PluginProductListView.as_view(), name="plugin-products"),
    path("plugin/download/", PluginDownloadView.as_view(), name="plugin-download"),
    path(
        "plugin/resend-activation-email/",
        PluginResendActivationEmailView.as_view(),
        name="plugin-resend-activation-email",
    ),
    path("mobile/app-info/", MobileAppInfoView.as_view(), name="mobile-app-info"),
    # Совместимость с fbx_receiver: GET /api/assets/{fileName}.glb|rfa|rvt
    path("assets/<path:file_path>", PluginAssetDirectView.as_view(), name="plugin-asset-direct"),
]
