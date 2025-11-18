#!/bin/bash
# Скрипт настройки firewall
# Использование: sudo bash deploy/setup-firewall.sh

set -e

echo "=== Настройка Firewall (UFW) ==="

# Установка UFW если не установлен
if ! command -v ufw &> /dev/null; then
    apt install -y ufw
fi

# Разрешаем SSH
echo "Разрешение SSH..."
ufw allow OpenSSH

# Разрешаем HTTP и HTTPS
echo "Разрешение HTTP и HTTPS..."
ufw allow 'Nginx Full'

# Включаем firewall
echo "Включение firewall..."
ufw --force enable

# Показываем статус
echo ""
echo "=== Статус Firewall ==="
ufw status

echo ""
echo "Firewall настроен!"

