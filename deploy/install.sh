#!/bin/bash
# Скрипт автоматической установки зависимостей на VPS
# Использование: sudo bash deploy/install.sh

set -e

echo "=== Установка зависимостей для Sofa Marketplace ==="

# Обновление системы
echo "Обновление системы..."
apt update && apt upgrade -y

# Установка Python
echo "Установка Python..."
apt install -y python3 python3-pip python3-venv python3-dev
apt install -y build-essential

# Установка Node.js
echo "Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установка Nginx
echo "Установка Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# Установка Certbot
echo "Установка Certbot..."
apt install -y certbot python3-certbot-nginx

# Установка Git
echo "Установка Git..."
apt install -y git

# Установка дополнительных утилит
apt install -y curl wget nano htop

echo "=== Установка завершена ==="
echo ""
echo "Проверка версий:"
python3 --version
node --version
npm --version
nginx -v
echo ""
echo "Примечание: Используется SQLite (встроенная БД Django), PostgreSQL не требуется"

