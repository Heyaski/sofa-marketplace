#!/bin/bash
# Загрузка оптимизированных GLB в S3 (если USE_S3_STORAGE=1)
# Запускать ПОСЛЕ optimize-glb.sh
# Требуется: aws cli, настроенный .env с AWS_*

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/backend/media/assets"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Папка не найдена: $ASSETS_DIR"
  exit 1
fi

# Загружаем переменные из .env
for envfile in "$PROJECT_ROOT/backend/.env" "$PROJECT_ROOT/.env"; do
  if [ -f "$envfile" ]; then
    set -a
    source "$envfile" 2>/dev/null || true
    set +a
    break
  fi
done

if [ "${USE_S3_STORAGE}" != "1" ]; then
  echo "USE_S3_STORAGE не включён. Файлы отдаются с локального диска."
  echo "Оптимизированные файлы уже используются."
  exit 0
fi

BUCKET="${AWS_STORAGE_BUCKET_NAME}"
ENDPOINT="${AWS_S3_ENDPOINT_URL:-https://s3.beget.com}"

if [ -z "$BUCKET" ]; then
  echo "Укажите AWS_STORAGE_BUCKET_NAME в .env"
  exit 1
fi

echo "=== Загрузка оптимизированных GLB в S3 ==="
echo "Бакет: $BUCKET"
echo "Папка: $ASSETS_DIR"
echo ""

# aws s3 sync заменит файлы в S3 на локальные (оптимизированные)
aws s3 sync "$ASSETS_DIR" "s3://$BUCKET/assets/" \
  --endpoint-url "$ENDPOINT" \
  --exclude "*" \
  --include "*.glb" \
  --include "*.GLB" \
  --only-show-errors

echo "Готово. Оптимизированные GLB загружены в S3."
