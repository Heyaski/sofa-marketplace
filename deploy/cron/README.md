# Cron / systemd для бэкенда

## Обновление цен и наличия с INMYROOM (каждый день)

Команда уже есть в проекте: `manage.py sync_inmyroom_prices` (`backend/apps/catalog/management/commands/sync_inmyroom_prices.py`).
Сайт-источник: карточки **inmyroom.ru** по `shop_url` или артикулу вида **IMR-…**.

Помимо `price` в БД пишется `availability` (`in_stock` / `on_order` / `out_of_stock`) — для админки и будущего скрытия «нет в наличии»; в публичном API поле не отдаётся.

**Ручной запуск** (из каталога `backend`, с активированным venv):

```bash
python manage.py sync_inmyroom_prices --sleep 1 --set-shop-url
```

Пробный прогон без записи в БД: `--dry-run` (можно добавить `--verbose`).

**Автоматически:** каждый день в **00:00** по времени сервера — через crontab или systemd timer (см. ниже).

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
