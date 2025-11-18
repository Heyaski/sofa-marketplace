#!/bin/bash
# Скрипт резервного копирования
# Использование: bash deploy/backup.sh

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/backups"
PROJECT_DIR="$HOME/sofa-marketplace"

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"

echo "=== Создание резервной копии ==="

# Бэкап базы данных SQLite
echo "Бэкап базы данных SQLite..."
if [ -f "$PROJECT_DIR/backend/db.sqlite3" ]; then
    cp "$PROJECT_DIR/backend/db.sqlite3" "$BACKUP_DIR/db_$DATE.sqlite3"
    echo "База данных сохранена: $BACKUP_DIR/db_$DATE.sqlite3"
else
    echo "Предупреждение: Файл db.sqlite3 не найден"
fi

# Бэкап медиа файлов
echo "Бэкап медиа файлов..."
if [ -d "$PROJECT_DIR/backend/media" ]; then
    tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" -C "$PROJECT_DIR/backend" media/
    echo "Медиа файлы сохранены: $BACKUP_DIR/media_$DATE.tar.gz"
else
    echo "Предупреждение: Директория media не найдена"
fi

# Удаление старых бэкапов (старше 7 дней)
echo "Удаление старых бэкапов..."
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo ""
echo "=== Резервное копирование завершено ==="
echo "Бэкапы сохранены в: $BACKUP_DIR"

