from django.urls import path
from .views import PluginActivateView, PluginProductListView, PluginDownloadView

urlpatterns = [
    path("plugin/activate/", PluginActivateView.as_view(), name="plugin-activate"),
    path("plugin/products/", PluginProductListView.as_view(), name="plugin-products"),
    path("plugin/download/", PluginDownloadView.as_view(), name="plugin-download"),
]
