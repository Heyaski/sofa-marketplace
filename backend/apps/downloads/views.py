from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Download
from .serializers import DownloadSerializer

# Список всех доступных загрузок пользователя
class DownloadListView(generics.ListAPIView):
    serializer_class = DownloadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Download.objects.filter(user=self.request.user)

# Заглушка для presign
class PresignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"url": "about:blank"})
