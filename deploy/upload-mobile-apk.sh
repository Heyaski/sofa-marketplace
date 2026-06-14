#!/usr/bin/env bash
# Загрузить APK на сервер в frontend/public/downloads/vizhub-ar.apk
# Использование на VPS:
#   bash deploy/upload-mobile-apk.sh /path/to/vizhub-ar.apk
# или скачать с URL (например с expo.dev после сборки):
#   bash deploy/upload-mobile-apk.sh --url 'https://expo.dev/artifacts/eas/....apk'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT/frontend/public/downloads"
DEST_FILE="$DEST_DIR/vizhub-ar.apk"

mkdir -p "$DEST_DIR"

if [[ "${1:-}" == "--url" ]]; then
  URL="${2:?Укажите URL: bash deploy/upload-mobile-apk.sh --url 'https://...'}"
  echo "Скачиваю APK..."
  curl -fsSL -o "$DEST_FILE" "$URL"
elif [[ -n "${1:-}" ]]; then
  SRC="$1"
  if [[ ! -f "$SRC" ]]; then
    echo "Файл не найден: $SRC" >&2
    exit 1
  fi
  cp "$SRC" "$DEST_FILE"
else
  echo "Использование:" >&2
  echo "  bash deploy/upload-mobile-apk.sh /path/to/app.apk" >&2
  echo "  bash deploy/upload-mobile-apk.sh --url 'https://expo.dev/artifacts/eas/....apk'" >&2
  exit 1
fi

chmod 644 "$DEST_FILE"
BYTES=$(stat -c%s "$DEST_FILE" 2>/dev/null || stat -f%z "$DEST_FILE")
echo "OK: $DEST_FILE ($BYTES bytes)"

# Next.js standalone: symlink public/downloads в .next/standalone/public/
if [ -f "$ROOT/frontend/package.json" ]; then
  node "$ROOT/frontend/scripts/sync-standalone-downloads.cjs" 2>/dev/null || true
fi

echo ""
echo "Важно: для APK надёжнее отдавать через nginx (см. deploy/nginx-frontend.conf.example):"
echo "  location /downloads/ { alias $DEST_DIR/; ... }"
echo ""
echo "Проверка (nginx): curl -I https://www.vizhub.pro/downloads/vizhub-ar.apk"
echo "Проверка (Next.js): curl -I http://127.0.0.1:3000/downloads/vizhub-ar.apk"
echo "backend/.env: MOBILE_APK_DOWNLOAD_URL=https://www.vizhub.pro/downloads/vizhub-ar.apk"
