from django.urls import path
from .views import DownloadListView, PresignView

urlpatterns = [
    path("", DownloadListView.as_view(), name="download-list"),
    path("presign/", PresignView.as_view(), name="download-presign"),
]
