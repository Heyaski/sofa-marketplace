#!/usr/bin/env bash
# Вызывается systemd (path/timer) после заливки по SFTP — debounce + lock, чтобы не гонять sync дважды.
set -euo pipefail

LOCK_FILE="${UPLOAD3D_SYNC_LOCK_FILE:-/run/sofa-upload3d-sync.lock}"
DEBOUNCE_SEC="${UPLOAD3D_SYNC_DEBOUNCE_SEC:-45}"
BACKEND_DIR="${SOFA_BACKEND_DIR:-/home/deploy/sofa-marketplace/backend}"
PYTHON="${SOFA_PYTHON:-$BACKEND_DIR/venv/bin/python}"

if [[ ! -x "$PYTHON" ]]; then
  echo "sync-upload3d: python not found: $PYTHON" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

sleep "$DEBOUNCE_SEC"
cd "$BACKEND_DIR"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}"

exec "$PYTHON" manage.py sync_upload3d_models
