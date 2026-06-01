Куда заливать GLB по SFTP
=========================

Правильно (рекомендуется):
  пользователь upload3d
  remotePath: /incoming
  (= /home/upload3d/models/incoming на сервере)

Часто в Cursor открывается по ошибке:
  backend/media/assets
  backend/media/assets/incoming

После git pull команда sync_upload3d_models сканирует и media/assets —
но надёжнее переключить remotePath на /incoming (см. sftp.json.example).

После заливки: подождать ~1 мин (авто-sync) или:
  cd backend && python manage.py sync_upload3d_models
  python manage.py diagnose_sftp_glb Кресло4049 Кресло4050
