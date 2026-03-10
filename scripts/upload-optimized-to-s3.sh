#!/bin/bash
# Загрузка оптимизированных GLB в S3 (если USE_S3_STORAGE=1)
# Запускать ПОСЛЕ optimize-glb.sh
# Использует Python/boto3 (корректно обрабатывает кириллические имена файлов)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Активируем venv если есть
if [ -f "$PROJECT_ROOT/backend/venv/bin/activate" ]; then
  source "$PROJECT_ROOT/backend/venv/bin/activate"
fi

exec python3 "$SCRIPT_DIR/upload-optimized-to-s3.py"
