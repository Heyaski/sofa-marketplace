#!/bin/bash
# Полное обновление до актуальной версии
# Использование: bash deploy/full-update.sh

set -e

PROJECT_DIR="$HOME/sofa-marketplace"
cd "$PROJECT_DIR"

echo "=== 1. Бэкап ==="
bash deploy/backup.sh || true

echo ""
echo "=== 2. Обновление кода из Git ==="
git fetch origin
git reset --hard origin/main

echo ""
echo "=== 3. Backend ==="
cd "$PROJECT_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt --quiet
python manage.py migrate
sudo systemctl restart sofa-backend

echo ""
echo "=== 4. Frontend (чистая сборка) ==="
cd "$PROJECT_DIR/frontend"
rm -rf .next
NEXT_PUBLIC_API_URL=https://api.vizhub.pro npm run build
sudo systemctl restart sofa-frontend

echo ""
echo "=== Готово ==="
echo "Сайт обновлён до актуальной версии."
