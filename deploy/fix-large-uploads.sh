#!/bin/bash
# Скрипт для настройки systemd лимитов для загрузки больших файлов (200GB)

set -e

echo "🔧 Настройка systemd лимитов для загрузки больших файлов..."

# Создаем директории для override конфигов
sudo mkdir -p /etc/systemd/system/nginx.service.d
sudo mkdir -p /etc/systemd/system/sofa-backend.service.d

# Настройка лимитов для nginx
echo "📝 Настройка лимитов для nginx..."
sudo tee /etc/systemd/system/nginx.service.d/override.conf > /dev/null <<EOF
[Service]
# Увеличиваем лимиты открытых файлов и процессов
LimitNOFILE=65536
LimitNPROC=65536
# Увеличиваем лимит памяти (необязательно, но рекомендуется)
# MemoryMax=2G
EOF

# Настройка лимитов для gunicorn/sofa-backend
echo "📝 Настройка лимитов для sofa-backend..."
sudo tee /etc/systemd/system/sofa-backend.service.d/override.conf > /dev/null <<EOF
[Service]
# Увеличиваем лимиты открытых файлов и процессов
LimitNOFILE=65536
LimitNPROC=65536
# Увеличиваем лимит памяти для обработки больших файлов
# MemoryMax=4G
EOF

# Применяем изменения
echo "🔄 Применение изменений..."
sudo systemctl daemon-reload

echo "✅ Лимиты настроены!"
echo ""
echo "📋 Проверка текущих лимитов:"
echo "Nginx:"
sudo systemctl show nginx | grep -E "LimitNOFILE|LimitNPROC" || true
echo ""
echo "Sofa-backend:"
sudo systemctl show sofa-backend | grep -E "LimitNOFILE|LimitNPROC" || true
echo ""
echo "⚠️  ВАЖНО: Перезапустите сервисы для применения изменений:"
echo "   sudo systemctl restart nginx"
echo "   sudo systemctl restart sofa-backend"
