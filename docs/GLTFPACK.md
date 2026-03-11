# gltfpack — оптимизация GLB

gltfpack уменьшает размер GLB и ускоряет рендер. Работает с model-viewer без доп. декодера.

## Цель: баланс качества и размера (~20 MB)

По умолчанию целевой размер 20 MB. gltfpack итеративно подбирает `-si` (0.33 → 0.25 → … → 0.08) до достижения размера. Не ниже 0.08 — сохраняет плавность геометрии. При импорте и в `optimize_glb_s3` — автоматически. Настройка: `GLB_TARGET_MB=20` в `.env`.

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
| `-si 0.2 … 0.08` | Итеративно до ≤ 10 MB |
| `-cc` | Доп. сжатие — требует meshopt decoder, не используется |

**Настройка:** `GLB_TARGET_MB=20` в `.env`. `GLB_USE_TEXTURE_COMPRESSION=0` — отключить сжатие текстур (если тёмные модели).

**Восстановление качества** (если модели стали угловатыми): нужны оригинальные файлы. Бэкап создаётся при первом запуске `optimize-glb.sh` на локальных файлах. Имена в бэкапе могут быть без суффикса Django (Пуф1497.glb вместо Пуф1497_hsDp1Ve.glb) — скрипт ищет оба варианта. Проверить маппинг: `python manage.py optimize_glb_s3 --list-backup`. Восстановить: `GLB_TARGET_MB=30` в `.env`, затем `python manage.py optimize_glb_s3 --restore-backup`.
 