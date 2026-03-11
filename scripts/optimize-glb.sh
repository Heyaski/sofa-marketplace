#!/bin/bash
# Оптимизация GLB моделей до 10 MB
# Итеративно пробует -si 0.2, 0.15, 0.12, 0.1 до достижения целевого размера

set -e

TARGET_MB="${GLB_TARGET_MB:-10}"

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
SKIP_BACKUP=false
for arg in "$@"; do
  case "$arg" in
    --no-backup) SKIP_BACKUP=true ;;
    [0-9.]*) TARGET_MB="$arg" ;;
  esac
done

TARGET_BYTES=$((TARGET_MB * 1024 * 1024))

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Папка не найдена: $ASSETS_DIR"
  exit 1
fi

echo "=== Оптимизация GLB до ${TARGET_MB} MB ==="
echo "Используется: $GLTFPACK"
echo "Папка: $ASSETS_DIR"
echo ""

# Бэкап при первом запуске (если не --no-backup и бэкапа ещё нет)
if [ "$SKIP_BACKUP" = false ]; then
  mkdir -p "$PROJECT_ROOT/backups"
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "Создаю бэкап в $BACKUP_DIR ..."
    cp -r "$ASSETS_DIR" "$BACKUP_DIR"
    echo "Бэкап создан (отдельно от assets)."
    echo ""
  fi
fi

count=0
for f in "$ASSETS_DIR"/*.glb "$ASSETS_DIR"/*.GLB; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  size_before=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
  size_mb_before=$((size_before / 1024 / 1024))
  
  # Пропускаем файлы уже ≤ целевого размера
  if [ $size_before -le $TARGET_BYTES ]; then
    echo "[$((count+1))] $name (${size_mb_before} MB) — уже ≤ ${TARGET_MB} MB, пропуск"
    count=$((count+1))
    continue
  fi

  echo "[$((count+1))] $name (${size_mb_before} MB) ..."
  
  tmp_orig="${f}.orig"
  cp "$f" "$tmp_orig"
  best_size=$size_before
  best_file=""
  for si_try in 0.25 0.2 0.15 0.12 0.1 0.08; do
    [ $size_mb_before -le 40 ] && [ "$si_try" = "0.25" ] && si_try="0.2"
    tmpfile=$(mktemp -u "${f%.*}-opt-XXXXXX.glb")
    if $GLTFPACK -i "$tmp_orig" -o "$tmpfile" -si "$si_try" 2>/dev/null; then
      size_after=$(stat -f%z "$tmpfile" 2>/dev/null || stat -c%s "$tmpfile" 2>/dev/null)
      if [ $size_after -lt $best_size ]; then
        rm -f "$best_file"
        best_size=$size_after
        best_file="$tmpfile"
        [ $size_after -le $TARGET_BYTES ] && break
      else
        rm -f "$tmpfile"
      fi
    else
      rm -f "$tmpfile"
    fi
  done
  rm -f "$tmp_orig"
  if [ -n "$best_file" ] && [ -f "$best_file" ]; then
    mv "$best_file" "$f"
    success=1
  fi
  if [ $success -eq 1 ]; then
    size_after=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
    size_mb_after=$((size_after / 1024 / 1024))
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
