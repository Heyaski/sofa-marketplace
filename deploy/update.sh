#!/bin/bash
# Скрипт обновления проекта на сервере
# Использование: bash deploy/update.sh

set -e

echo "=== Обновление проекта Sofa Marketplace ==="

PROJECT_DIR="$HOME/sofa-marketplace"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Ошибка: Директория проекта не найдена: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Обновление кода из Git
echo "Обновление кода из Git..."
git pull origin main || git pull origin master

# Обновление Backend
echo "Обновление Backend..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Перезапуск Backend
echo "Перезапуск Backend..."
sudo systemctl restart sofa-backend

# Обновление Frontend
echo "Обновление Frontend..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build

# Перезапуск Frontend
echo "Перезапуск Frontend..."
sudo systemctl restart sofa-frontend

echo ""
echo "=== Обновление завершено ==="
echo "Проверьте статус сервисов:"
echo "  sudo systemctl status sofa-backend"
echo "  sudo systemctl status sofa-frontend"

