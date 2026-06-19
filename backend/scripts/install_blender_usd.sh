#!/usr/bin/env bash
# Официальный Blender (с USD) для GLB→USDZ на сервере без Docker.
# apt install blender на Ubuntu обычно без wm.usd_export.
set -euo pipefail

BLENDER_VERSION="${BLENDER_VERSION:-4.2.11}"
INSTALL_DIR="${BLENDER_INSTALL_DIR:-/opt}"
ARCH="linux-x64"
MAJOR_MINOR="${BLENDER_VERSION%.*}"
TARBALL="blender-${BLENDER_VERSION}-${ARCH}.tar.xz"
URL="https://download.blender.org/release/Blender${MAJOR_MINOR}/${TARBALL}"
TARGET="${INSTALL_DIR}/blender-${BLENDER_VERSION}-${ARCH}"
BIN="${TARGET}/blender"

if [[ -x "${BIN}" ]]; then
  echo "Blender уже установлен: ${BIN}"
  "${BIN}" --version | head -1
  exit 0
fi

echo "Скачивание Blender ${BLENDER_VERSION} (с USD)..."
tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "Нужен curl: sudo apt install curl"
  exit 1
fi

curl -fsSL "${URL}" -o "${tmpdir}/${TARBALL}"
sudo mkdir -p "${INSTALL_DIR}"
sudo tar -xJf "${tmpdir}/${TARBALL}" -C "${INSTALL_DIR}"

if [[ ! -x "${BIN}" ]]; then
  echo "Ошибка: бинарник не найден: ${BIN}"
  exit 1
fi

echo ""
echo "Готово: ${BIN}"
"${BIN}" --version | head -1
echo ""
echo "Добавьте в backend/.env:"
echo "  BLENDER_BIN=${BIN}"
echo "  GLB_TO_USDZ_ENABLED=1"
echo ""
echo "Проверка:"
echo "  cd backend && source venv/bin/activate"
echo "  python manage.py ar_ios_status"
echo "  python manage.py convert_product_usdz --id=21"
