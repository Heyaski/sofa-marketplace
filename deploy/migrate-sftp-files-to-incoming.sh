#!/usr/bin/env bash
# Перенести модели, залитые по ошибке в backend/media/assets, в SFTP incoming.
# Запуск: sudo bash deploy/migrate-sftp-files-to-incoming.sh
set -euo pipefail

DEPLOY_USER="${SOFA_DEPLOY_USER:-deploy}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
MEDIA_ASSETS="${DEPLOY_HOME}/sofa-marketplace/backend/media/assets"
MEDIA_INCOMING="${MEDIA_ASSETS}/incoming"
INCOMING="${UPLOAD3D_MODELS_INCOMING_DIR:-/home/upload3d/models}/incoming"
UPLOAD3D_USER="${UPLOAD3D_USER:-upload3d}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash deploy/migrate-sftp-files-to-incoming.sh" >&2
  exit 1
fi

mkdir -p "$INCOMING" "$MEDIA_INCOMING"
shopt -s nullglob
moved=0
for ext in glb gltf fbx rfa ifc usdz obj; do
  for f in \
    "$MEDIA_ASSETS"/*."$ext" "$MEDIA_ASSETS"/*."${ext^^}" \
    "$MEDIA_INCOMING"/*."$ext" "$MEDIA_INCOMING"/*."${ext^^}"; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    echo "→ $base"
    mv -f "$f" "$INCOMING/"
    chown "${UPLOAD3D_USER}:${UPLOAD3D_USER}" "$INCOMING/$base"
    moved=$((moved + 1))
  done
done

if [[ "$moved" -eq 0 ]]; then
  echo "В $MEDIA_ASSETS нет .glb/.rfa/.ifc на верхнем уровне."
else
  echo "Перенесено: $moved. Импорт запустится сам (path unit) или:"
  echo "  cd ${DEPLOY_HOME}/sofa-marketplace/backend && python manage.py sync_upload3d_models"
fi
