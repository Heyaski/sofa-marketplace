#!/bin/bash
# Установка нативного gltfpack для Linux (обход ограничений npm/WASM на файлах 60+ MB)
# Запуск: ./scripts/install-gltfpack-native.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
ARCH=$(uname -m)
OS=$(uname -s)

# Определяем URL для загрузки
if [ "$OS" = "Linux" ]; then
  if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
    URL="https://github.com/zeux/meshoptimizer/releases/download/v1.0/gltfpack-ubuntu.zip"
  else
    echo "Архитектура $ARCH не поддерживается. Соберите gltfpack из исходников."
    exit 1
  fi
elif [ "$OS" = "Darwin" ]; then
  URL="https://github.com/zeux/meshoptimizer/releases/download/v1.0/gltfpack-macos.zip"
else
  echo "ОС $OS не поддерживается."
  exit 1
fi

mkdir -p "$BIN_DIR"
cd "$BIN_DIR"

echo "Загрузка gltfpack..."
if command -v curl &>/dev/null; then
  curl -sL -o gltfpack.zip "$URL"
elif command -v wget &>/dev/null; then
  wget -q -O gltfpack.zip "$URL"
else
  echo "Установите curl или wget"
  exit 1
fi

echo "Распаковка..."
unzip -o gltfpack.zip
rm -f gltfpack.zip

# Архив может содержать gltfpack в корне или в подпапке
FOUND=$(find . -name gltfpack -type f 2>/dev/null | head -1)
if [ -n "$FOUND" ] && [ "$FOUND" != "./gltfpack" ]; then
  mv "$FOUND" ./gltfpack
fi
[ -f gltfpack ] && chmod +x gltfpack

if [ -f gltfpack ]; then
  echo "Готово. gltfpack установлен в $BIN_DIR"
  ./gltfpack -h | head -2
else
  echo "Ошибка: gltfpack не найден после распаковки"
  ls -la
  exit 1
fi
