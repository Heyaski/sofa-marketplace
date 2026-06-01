#!/usr/bin/env bash
# SFTP upload3d → только /home/upload3d/models/incoming (оттуда читает sync_upload3d_models).
# Запуск на VPS: sudo bash deploy/setup-upload3d-sftp.sh
set -euo pipefail

UPLOAD3D_USER="${UPLOAD3D_USER:-upload3d}"
DEPLOY_USER="${SOFA_DEPLOY_USER:-deploy}"
MODELS_ROOT="${UPLOAD3D_MODELS_ROOT:-/home/upload3d/models}"
INCOMING="${MODELS_ROOT}/incoming"
IMPORTED="${MODELS_ROOT}/imported"
UPLOAD3D_HOME="/home/${UPLOAD3D_USER}"
SSHD_SNIPPET="/etc/ssh/sshd_config.d/99-sofa-upload3d.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash deploy/setup-upload3d-sftp.sh" >&2
  exit 1
fi

if ! id "$UPLOAD3D_USER" &>/dev/null; then
  useradd -m -d "$UPLOAD3D_HOME" -s /usr/sbin/nologin -G sftp "$UPLOAD3D_USER" 2>/dev/null \
    || useradd -m -d "$UPLOAD3D_HOME" -s /usr/sbin/nologin "$UPLOAD3D_USER"
fi

# Каталоги для chroot (корень models — root:root, incoming — upload3d)
mkdir -p "$UPLOAD3D_HOME" "$MODELS_ROOT" "$INCOMING" "$IMPORTED"
chown root:root "$UPLOAD3D_HOME" "$MODELS_ROOT"
chmod 755 "$UPLOAD3D_HOME" "$MODELS_ROOT"
chown "${UPLOAD3D_USER}:${UPLOAD3D_USER}" "$INCOMING" "$IMPORTED"
chmod 2775 "$INCOMING" "$IMPORTED"
usermod -aG "$UPLOAD3D_USER" "$DEPLOY_USER" 2>/dev/null || true

OLD_HOME="$(getent passwd "$UPLOAD3D_USER" | cut -d: -f6 || true)"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6 || echo "/home/deploy")"
WRONG_MEDIA="${DEPLOY_HOME}/sofa-marketplace/backend/media/assets"
if [[ "$OLD_HOME" == *"media/assets"* ]]; then
  echo "⚠️  Раньше SFTP смотрел в media/assets — перенастраиваем на $INCOMING"
fi
usermod -d "$UPLOAD3D_HOME" "$UPLOAD3D_USER"

mkdir -p /etc/ssh/sshd_config.d
cat >"$SSHD_SNIPPET" <<EOF
# Sofa Marketplace: SFTP только в ${MODELS_ROOT} (заливка в incoming/)
Match User ${UPLOAD3D_USER}
    ChrootDirectory ${MODELS_ROOT}
    ForceCommand internal-sftp
    AllowTcpForwarding no
    X11Forwarding no
    PasswordAuthentication yes
EOF

if sshd -t 2>/dev/null; then
  systemctl reload ssh sshd 2>/dev/null || systemctl reload sshd 2>/dev/null || true
else
  echo "⚠️  Проверьте sshd: sshd -t" >&2
fi

echo ""
echo "✅ SFTP пользователь ${UPLOAD3D_USER}: при входе видна папка incoming/ (это ${INCOMING})"
echo "   Не заливайте в backend/media/assets — туда импорт не смотрит."
echo ""
echo "В Cursor скопируйте .vscode/sftp.json.example → sftp.json и укажите host."
echo "   remotePath: /incoming"
