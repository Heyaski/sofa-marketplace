#!/bin/bash
# Скрипт настройки базы данных PostgreSQL
# Использование: sudo bash deploy/setup-db.sh

set -e

echo "=== Настройка базы данных PostgreSQL ==="

# Запрашиваем данные
read -p "Имя базы данных [sofa_marketplace]: " DB_NAME
DB_NAME=${DB_NAME:-sofa_marketplace}

read -p "Имя пользователя [deploy]: " DB_USER
DB_USER=${DB_USER:-deploy}

read -sp "Пароль пользователя: " DB_PASSWORD
echo ""

# Создаем базу данных и пользователя
sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
ALTER ROLE $DB_USER SET client_encoding TO 'utf8';
ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';
ALTER ROLE $DB_USER SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOF

echo ""
echo "=== База данных создана ==="
echo "Имя БД: $DB_NAME"
echo "Пользователь: $DB_USER"
echo ""
echo "Добавьте в .env файл:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

