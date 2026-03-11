# gltfpack — оптимизация GLB

gltfpack уменьшает размер GLB и ускоряет рендер. Работает с model-viewer без доп. декодера.

## Цель: 60 MB → ~20 MB

Для уменьшения размера с ~60 MB до ~20 MB используйте `-si 0.33` (упрощение до ~33% полигонов). Режим по умолчанию добавляет mesh optimization + quantization (KHR_mesh_quantization), совместим с model-viewer.

## Установка

**Для файлов 60+ MB обязателен нативный бинарник** — npm-версия (WASM) падает с ошибкой из‑за ограничения памяти.

**Нативный gltfpack (Linux/macOS):**
```bash
chmod +x scripts/install-gltfpack-native.sh
./scripts/install-gltfpack-native.sh
```
Скачивает бинарник в `scripts/bin/`. Скрипт `optimize-glb.sh` автоматически использует его.

**Альтернатива — npm (только для небольших файлов <20 MB):**
```bash
npm install -g gltfpack   # или: npx gltfpack ...
```

## Использование

**Один файл (цель ~20 MB):**
```bash
gltfpack -i model.glb -o model-opt.glb -si 0.33
```

**Скрипт для всех GLB в папке:**
```bash
./scripts/install-gltfpack-native.sh   # один раз, для файлов 60+ MB
./scripts/optimize-glb.sh
```

**Автоматическая оптимизация при импорте** — новые GLB, загружаемые через админку или API, автоматически оптимизируются перед сохранением в S3 (GLBOptimizingS3Storage). Отключить: `GLB_OPTIMIZE_ON_SAVE=0` в `.env`.

**Если используется S3** — два варианта:

1. **Рекомендуется: оптимизация по путям из БД** (решает проблему с суффиксами Django):
```bash
./scripts/install-gltfpack-native.sh   # один раз
./scripts/optimize-glb-s3.sh
```
Скрипт скачивает GLB из S3 по точным путям FileAsset, оптимизирует и загружает обратно. Django может добавлять суффикс к именам (Пуф1497.glb → Пуф1497_hsDp1Ve.glb) — этот скрипт использует правильные ключи.

2. **Альтернатива: локальные файлы + загрузка** (если файлы есть в `backend/media/assets`):
```bash
./scripts/optimize-glb.sh
./scripts/upload-optimized-to-s3.sh
```
Внимание: `upload-optimized-to-s3.sh` загружает по имени файла (`assets/имя.glb`). Если в БД путь с суффиксом (`assets/имя_xyz.glb`), файл не перезапишется — используйте `optimize-glb-s3.sh`.

Бэкап сохраняется в `backups/glb-assets-original/` (не в media).

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
 