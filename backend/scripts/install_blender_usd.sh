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

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/.." && pwd)/.env}"

write_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    if grep -q '^BLENDER_BIN=' "${ENV_FILE}"; then
      sed -i "s|^BLENDER_BIN=.*|BLENDER_BIN=${BIN}|" "${ENV_FILE}"
      echo "Обновлён BLENDER_BIN в ${ENV_FILE}"
    else
      printf '\nBLENDER_BIN=%s\nGLB_TO_USDZ_ENABLED=1\n' "${BIN}" >> "${ENV_FILE}"
      echo "Добавлен BLENDER_BIN в ${ENV_FILE}"
    fi
  else
    printf 'BLENDER_BIN=%s\nGLB_TO_USDZ_ENABLED=1\n' "${BIN}" > "${ENV_FILE}"
    echo "Создан ${ENV_FILE}"
  fi
}

if [[ -x "${BIN}" ]]; then
  echo "Blender уже установлен: ${BIN}"
  "${BIN}" --version | head -1
  write_env
  echo ""
  echo "Перезапустите backend: sudo systemctl restart sofa-backend"
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

write_env

echo ""
echo "Готово: ${BIN}"
"${BIN}" --version | head -1
echo ""
echo "BLENDER_BIN уже записан в ${ENV_FILE}"
echo ""
echo "Перезапустите backend: sudo systemctl restart sofa-backend"
echo "Проверка:"
echo "  cd backend && source venv/bin/activate"
echo "  python manage.py ar_ios_status"
echo "  python manage.py convert_product_usdz --id=21"
