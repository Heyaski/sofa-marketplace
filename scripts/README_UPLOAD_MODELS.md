# Загрузка моделей на SFTP-сервер

**Куда:** `/home/upload3d/models/incoming/` (в Cursor: `remotePath` = `/incoming`, см. `.vscode/sftp.json.example`).  
**Не сюда:** `backend/media/assets` — импорт не читает.

На сервере один раз: `sudo bash deploy/setup-upload3d-sftp.sh` и `sudo bash deploy/install-upload3d-auto-sync.sh`.  
Дальше импорт после заливки автоматический.

**Важно:** на удалённую сторону нужно отправлять **распакованные файлы** (`.glb`, `.rfa`, `.ifc`, изображения и т.д.), а не сам ZIP-архив. Если залить `.zip`, на сервере окажется один артефакт-архив, а приложения модели из него не увидят.

## Windows (локально или из PowerShell Cursor-агента)

```powershell
# Явный путь к архиву
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/upload_zip_to_models.ps1 -ZipPath "D:\incoming\models.zip"
```

Или двойной клик / `scripts\upload_zip_to_models.bat` (по умолчанию ждёт `scripts\2GLB.zip`, либо перетащите zip на `.bat`).

Скрипт **сам распаковывает** архив во временную папку и заливает только разрешённые расширения.

## Linux / macOS / WSL / агент на Unix

```bash
chmod +x scripts/upload_zip_to_models.sh
./scripts/upload_zip_to_models.sh /path/to/archive.zip
```

Переменные окружения (опционально): `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `REMOTE_DIR`, `SFTP_KEY`.

## Что делать автоматизации (ИИ / CI)

Не вызывайте «голый» `scp`/`sftp put` архива на `/models`. Всегда используйте один из скриптов выше **или** в своём пайплайне распакуйте ZIP и отправьте отдельные файлы тем же фильтром расширений, что в `upload_zip_to_models.ps1`.
