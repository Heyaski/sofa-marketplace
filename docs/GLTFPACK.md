# gltfpack — оптимизация GLB

gltfpack уменьшает размер GLB и ускоряет рендер. Работает с model-viewer без доп. декодера.

## Цель: 60 MB → ~20 MB

Для уменьшения размера с ~60 MB до ~20 MB используйте `-si 0.33` (упрощение до ~33% полигонов). Режим по умолчанию добавляет mesh optimization + quantization (KHR_mesh_quantization), совместим с model-viewer.

## Установка

**Вариант 1 — npx (рекомендуется, без прав root):**
```bash
npx gltfpack -i input.glb -o output.glb -si 0.33
```
Скрипты `optimize-glb.sh` и `optimize-glb.ps1` автоматически используют npx, если gltfpack не установлен глобально.

**Вариант 2 — глобальная установка:**
```bash
npm install -g gltfpack
```
При ошибке EACCES на сервере — используйте npx или настройте prefix: `npm config set prefix ~/.npm-global`

## Использование

**Один файл (цель ~20 MB):**
```bash
gltfpack -i model.glb -o model-opt.glb -si 0.33
```

**Скрипт для всех GLB в папке** — см. `scripts/optimize-glb.sh` (Linux/macOS) или `scripts/optimize-glb.ps1` (Windows).

**Ручная обработка (Linux/macOS):**
```bash
cd backend/media/assets
for f in *.glb *.GLB; do
  [ -f "$f" ] && gltfpack -i "$f" -o "${f%.*}-opt.glb" -si 0.33
done
```

**Замена оригинала (с бэкапом):**
```bash
cd backend/media/assets
cp -r . ../assets-backup
for f in *.glb *.GLB; do
  [ -f "$f" ] && gltfpack -i "$f" -o "$f.tmp" -si 0.33 && mv "$f.tmp" "$f"
done
```

## Опции

| Опция | Описание |
|-------|----------|
| (без опций) | Mesh optimization + quantization |
| `-si 0.33` | Упрощение до ~33% полигонов (цель 60→20 MB) |
| `-si 0.5` | Упрощение до 50% полигонов (если 0.33 даёт артефакты) |
| `-cc` | Доп. сжатие — требует meshopt decoder в приложении, не используется |

**Подсказка:** Если после `-si 0.33` качество заметно ухудшилось, попробуйте `-si 0.5` — размер будет ~30–35 MB, но визуально лучше.
 