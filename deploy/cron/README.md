# Cron / systemd для бэкенда

## SFTP upload3d → каталог (FileAsset + товары)

Заказчик заливает `.glb` / `.rfa` / `.ifc` / фото на сервер по SFTP в каталог **`/home/upload3d/models`** (пользователь `upload3d`). Django сам не видит эту папку, пока не запустить:

```bash
python manage.py sync_upload3d_models
```

Та же логика, что [массовый импорт ZIP](https://api.vizhub.pro/admin/catalog/fileasset/import-files/) в админке: FileAsset в S3, привязка по артикулу из имени файла (`IMR-556065.glb` и т.д.), поля `model_glb` / `model_rfa` / `model_ifc`.

Переменные в `.env` (опционально):

- `UPLOAD3D_MODELS_INCOMING_DIR=/home/upload3d/models`
- `UPLOAD3D_MODELS_IMPORTED_SUBDIR=imported` — сюда переносятся обработанные файлы

Автоматически:
- событие по появлению/изменению файлов в `/home/upload3d/models` (systemd path watcher, см. ниже),
- или каждые 10 минут через cron: `sync-upload3d-models.crontab.example`.

**Права:** пользователь `deploy` должен читать `/home/upload3d/models` (например, группа `upload3d` и `chmod g+rx`).

### Вариант: systemd path (рекомендуется — по событию)

1. Установите unit-файлы:

```bash
sudo cp deploy/systemd/sofa-sync-upload3d-models.service.example /etc/systemd/system/sofa-sync-upload3d-models.service
sudo cp deploy/systemd/sofa-sync-upload3d-models.path.example /etc/systemd/system/sofa-sync-upload3d-models.path
```

2. Включите watcher:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sofa-sync-upload3d-models.path
sudo systemctl status sofa-sync-upload3d-models.path --no-pager
```

3. Проверка:

```bash
sudo systemctl start sofa-sync-upload3d-models.service
journalctl -u sofa-sync-upload3d-models.service -n 50 --no-pager
```

---

## Обновление цен и наличия с INMYROOM (каждый день)

Команда уже есть в проекте: `manage.py sync_inmyroom_prices` (`backend/apps/catalog/management/commands/sync_inmyroom_prices.py`).
Сайт-источник: карточки **inmyroom.ru** по `shop_url` или артикулу вида **IMR-…**.

Помимо `price` в БД пишется `availability` (`in_stock` / `on_order` / `out_of_stock`) — для админки и будущего скрытия «нет в наличии»; в публичном API поле не отдаётся.

**Ручной запуск** (из каталога `backend`, с активированным venv):

```bash
python manage.py sync_inmyroom_prices --sleep 0.3 --workers 4 --set-shop-url
```

Оптимизации по умолчанию:
- только товары с `shop_url` на inmyroom или артикулом `IMR-*` (не весь каталог);
- одна загрузка страницы на уникальную карточку (варианты `IMR-123(1)` / `IMR-123WHT` — один запрос);
- `--workers 4` — параллельные запросы; `--sleep 0.3` — пауза после каждого запроса.

Полный обход всех товаров в БД (медленно): `--all-products`.  
Пробный прогон без записи: `--dry-run` (можно `--verbose`).

**Автоматически:** каждый день в **00:00** (часовой пояс — см. `TZ=` в crontab) — через crontab или systemd timer (см. ниже).

### Вариант: crontab

См. `sync-inmyroom-prices.crontab.example`: скопируйте строку, поправьте пути к `backend`, venv и к файлу логов.

Создайте каталог для лога при необходимости:

```bash
mkdir -p /home/deploy/sofa-marketplace/backend/logs
```

### Вариант: systemd timer

1. Установите unit-файлы (пути поправьте под сервер):

   ```bash
   sudo cp deploy/systemd/sofa-sync-inmyroom-prices.service.example /etc/systemd/system/sofa-sync-inmyroom-prices.service
   sudo cp deploy/systemd/sofa-sync-inmyroom-prices.timer.example /etc/systemd/system/sofa-sync-inmyroom-prices.timer
   ```

2. Таймер по умолчанию: `OnCalendar=*-*-* 00:00:00` (полночь, локальное время сервера).

3. Включение:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now sofa-sync-inmyroom-prices.timer
   sudo systemctl list-timers sofa-sync-inmyroom-prices.timer
   ```

Проверка вручную:

```bash
sudo systemctl start sofa-sync-inmyroom-prices.service
journalctl -u sofa-sync-inmyroom-prices.service -n 50
```

Первый пробный запуск можно сделать локально или на сервере с `--dry-run`:

```bash
cd backend && python manage.py sync_inmyroom_prices --dry-run --verbose
```
