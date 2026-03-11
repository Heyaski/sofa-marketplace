#!/bin/bash
# Оптимизация GLB в S3 по путям из Django (FileAsset).
# Скачивает из S3, оптимизирует gltfpack, загружает обратно.
# Использует точные ключи из БД — решает проблему с суффиксами Django (Пуф1497.glb → Пуф1497_hsDp1Ve.glb).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/backend/venv/bin/activate" ]; then
  source "$PROJECT_ROOT/backend/venv/bin/activate"
fi

cd "$PROJECT_ROOT/backend"
python manage.py optimize_glb_s3
