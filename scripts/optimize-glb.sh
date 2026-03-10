#!/bin/bash
# Оптимизация GLB моделей: 60 MB → ~20 MB
# Использует gltfpack с -si 0.33 (упрощение до ~33% полигонов)
# Требуется: npm install -g gltfpack

set -e

# Нативный бинарник (для файлов 60+ MB) приоритетнее npm/WASM
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE_GLTFPACK="$SCRIPT_DIR/bin/gltfpack"

if [ -x "$NATIVE_GLTFPACK" ]; then
  GLTFPACK="$NATIVE_GLTFPACK"
elif command -v gltfpack &>/dev/null; then
  GLTFPACK="gltfpack"
elif command -v npx &>/dev/null; then
  GLTFPACK="npx gltfpack"
else
  echo "gltfpack не найден. Для файлов 60+ MB нужен нативный бинарник:"
  echo "  ./scripts/install-gltfpack-native.sh"
  echo "Или: npm install -g gltfpack (может не работать с большими файлами)"
  exit 1
fi

ASSETS_DIR="$PROJECT_ROOT/backend/media/assets"
BACKUP_DIR="$PROJECT_ROOT/backups/glb-assets-original"
SI_RATIO="${1:-0.33}"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Папка не найдена: $ASSETS_DIR"
  exit 1
fi

echo "=== Оптимизация GLB (gltfpack -si $SI_RATIO) ==="
echo "Используется: $GLTFPACK"
echo "Папка: $ASSETS_DIR"
echo ""

# Бэкап при первом запуске (в отдельную папку backups/, не в media)
mkdir -p "$PROJECT_ROOT/backups"
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Создаю бэкап в $BACKUP_DIR ..."
  cp -r "$ASSETS_DIR" "$BACKUP_DIR"
  echo "Бэкап создан (отдельно от assets)."
  echo ""
fi

count=0
for f in "$ASSETS_DIR"/*.glb "$ASSETS_DIR"/*.GLB; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  size_before=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
  size_mb_before=$((size_before / 1024 / 1024))
  
  echo "[$((count+1))] $name (${size_mb_before} MB) ..."
  
  tmpfile="${f%.*}-opt.glb"
  si_try="$SI_RATIO"
  success=0
  for retry in 1 2; do
    if $GLTFPACK -i "$f" -o "$tmpfile" -si "$si_try" 2>/dev/null; then
      success=1
      break
    fi
    rm -f "$tmpfile"
    if [ $retry -eq 1 ] && [ $size_mb_before -gt 40 ]; then
      si_try="0.5"
      echo "    Повтор с -si 0.5 (меньше памяти)..."
    else
      break
    fi
  done
  if [ $success -eq 1 ]; then
    size_after=$(stat -f%z "$tmpfile" 2>/dev/null || stat -c%s "$tmpfile" 2>/dev/null)
    size_mb_after=$((size_after / 1024 / 1024))
    mv "$tmpfile" "$f"
    echo "    → ${size_mb_after} MB (было ${size_mb_before} MB)"
  else
    echo "    ОШИБКА: gltfpack не сработал"
  fi
  count=$((count+1))
  echo ""
done

if [ $count -eq 0 ]; then
  echo "GLB файлы не найдены."
else
  echo "Готово. Обработано файлов: $count"
fi
