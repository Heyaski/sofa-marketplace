from django.urls import path, include

urlpatterns = [
    path("", include("apps.catalog.urls")),
    path("", include("apps.baskets.urls")),
    path("", include("apps.subscriptions.urls")),
    path("", include("apps.downloads.urls")),
]
