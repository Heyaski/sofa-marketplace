#!/usr/bin/env bash
# Один раз на VPS: автоматический импорт после SFTP (systemd path + timer).
# Запуск: sudo bash deploy/install-upload3d-auto-sync.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_USER="${SOFA_DEPLOY_USER:-deploy}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
BACKEND="${SOFA_BACKEND_DIR:-$DEPLOY_HOME/sofa-marketplace/backend}"
WATCH_PRIMARY="${UPLOAD3D_MODELS_INCOMING_DIR:-/home/upload3d/models}"
WATCH_INCOMING="${WATCH_PRIMARY}/incoming"
WATCH_IMPORTED="${WATCH_PRIMARY}/imported"
WATCH_EXTRA="${UPLOAD3D_MODELS_INCOMING_DIRS:-/models}"

mkdir -p "$WATCH_PRIMARY/incoming" "$WATCH_PRIMARY/imported" 2>/dev/null || true
chown "${DEPLOY_USER}:upload3d" "$WATCH_PRIMARY/incoming" 2>/dev/null || true
chmod 2775 "$WATCH_PRIMARY/incoming" 2>/dev/null || true

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash deploy/install-upload3d-auto-sync.sh" >&2
  exit 1
fi

chmod +x "$REPO_ROOT/deploy/scripts/sync-upload3d-debounced.sh"

render_unit() {
  local src="$1" dest="$2"
  sed -e "s|/home/deploy/sofa-marketplace|$DEPLOY_HOME/sofa-marketplace|g" \
      -e "s|User=deploy|User=$DEPLOY_USER|g" \
      -e "s|Group=deploy|Group=$DEPLOY_USER|g" \
      "$src" >"$dest"
}

SERVICE_DST="/etc/systemd/system/sofa-sync-upload3d-models.service"
PATH_DST="/etc/systemd/system/sofa-sync-upload3d-models.path"
TIMER_DST="/etc/systemd/system/sofa-sync-upload3d-models.timer"

render_unit "$REPO_ROOT/deploy/systemd/sofa-sync-upload3d-models.service.example" "$SERVICE_DST"

# Path unit: подставить каталоги наблюдения
{
  echo "[Unit]"
  echo "Description=Watch upload3d SFTP folders and import into catalog"
  echo ""
  echo "[Path]"
  echo "PathExists=$WATCH_PRIMARY"
  echo "PathChanged=$WATCH_PRIMARY"
  echo "PathExists=$WATCH_INCOMING"
  echo "PathChanged=$WATCH_INCOMING"
  echo "PathExists=$WATCH_IMPORTED"
  echo "PathChanged=$WATCH_IMPORTED"
  if [[ -n "$WATCH_EXTRA" && "$WATCH_EXTRA" != "$WATCH_PRIMARY" ]]; then
    if [[ -d "$WATCH_EXTRA" ]]; then
      echo "PathExists=$WATCH_EXTRA"
      echo "PathChanged=$WATCH_EXTRA"
    else
      echo "# $WATCH_EXTRA не найден — создайте или поправьте UPLOAD3D_MODELS_INCOMING_DIRS" >&2
    fi
  fi
  echo "Unit=sofa-sync-upload3d-models.service"
  echo ""
  echo "[Install]"
  echo "WantedBy=multi-user.target"
} >"$PATH_DST"

render_unit "$REPO_ROOT/deploy/systemd/sofa-sync-upload3d-models.timer.example" "$TIMER_DST"

systemctl daemon-reload
systemctl enable --now sofa-sync-upload3d-models.path
systemctl enable --now sofa-sync-upload3d-models.timer

echo ""
echo "Готово. После заливки по SFTP импорт запустится сам (~45 с пауза + sync)."
echo ""
echo "Куда класть файлы в Cursor/SFTP:"
echo "  Рекомендуется: $WATCH_INCOMING"
echo "  Можно:         $WATCH_PRIMARY (корень models/)"
echo "  Тоже обработается: $WATCH_IMPORTED (у вас файлы уже здесь)"
echo "  path:  $(systemctl is-active sofa-sync-upload3d-models.path)"
echo "  timer: $(systemctl is-active sofa-sync-upload3d-models.timer) (каждые ~5 мин резерв)"
echo ""
echo "Проверка: положите файл в $WATCH_PRIMARY и смотрите журнал:"
echo "  journalctl -u sofa-sync-upload3d-models.service -f"
echo ""
echo "Права: пользователь $DEPLOY_USER должен читать $WATCH_PRIMARY"
echo "  sudo usermod -aG upload3d $DEPLOY_USER   # при необходимости"
