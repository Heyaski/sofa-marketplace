from django.urls import path
from .views import DownloadListView, DownloadDeleteView, PresignView

urlpatterns = [
    path("downloads/", DownloadListView.as_view(), name="download-list"),
    path("downloads/<int:pk>/", DownloadDeleteView.as_view(), name="download-delete"),
    path("downloads/presign/", PresignView.as_view(), name="download-presign"),
]
