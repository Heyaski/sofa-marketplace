# Исправление ошибки запуска сервиса после добавления ЮКассы

## Проблема

После добавления интеграции с ЮКассой сервис не запускается с ошибкой:
```
Job for sofa-backend.service failed because the control process exited with error code.
```

## Причина

Скорее всего, пакет `yookassa` не установлен в виртуальном окружении на сервере.

## Решение

### Шаг 1: Проверьте логи для точной диагностики

```bash
sudo journalctl -xeu sofa-backend.service -n 50 --no-pager
```

Ищите ошибки типа:
- `ModuleNotFoundError: No module named 'yookassa'`
- `ImportError: cannot import name 'Configuration' from 'yookassa'`

### Шаг 2: Установите пакет yookassa

```bash
# Перейдите в директорию проекта
cd ~/sofa-marketplace/backend

# Активируйте виртуальное окружение
source venv/bin/activate

# Установите пакет
pip install yookassa==3.0.0

# Или установите все зависимости из requirements.txt
pip install -r requirements.txt
```

### Шаг 3: Проверьте, что пакет установлен

```bash
# В активированном виртуальном окружении
python -c "import yookassa; print(yookassa.__version__)"
```

Должно вывести версию пакета без ошибок.

### Шаг 4: Проверьте Django конфигурацию

```bash
# В активированном виртуальном окружении
python manage.py check
```

Если есть ошибки, исправьте их.

### Шаг 5: Перезапустите сервис

```bash
sudo systemctl daemon-reload
sudo systemctl restart sofa-backend.service
sudo systemctl status sofa-backend.service
```

## Альтернативное решение: Если импорт необязателен

Если вы хотите, чтобы сервис запускался даже без настроенной ЮКассы, можно сделать импорт опциональным:

Измените `backend/services/yookassa_service.py`:

```python
try:
    from yookassa import Configuration, Payment
    YOOKASSA_AVAILABLE = True
except ImportError:
    YOOKASSA_AVAILABLE = False
    Configuration = None
    Payment = None
```

И в методе `__init__`:

```python
def __init__(self):
    if not YOOKASSA_AVAILABLE:
        raise ImportError("yookassa package is not installed. Run: pip install yookassa")
    # ... остальной код
```

Но лучше просто установить пакет, так как он нужен для работы подписок.

## Проверка после исправления

```bash
# Проверьте статус
sudo systemctl status sofa-backend.service

# Проверьте логи
sudo journalctl -u sofa-backend.service -n 20 --no-pager

# Если все хорошо, сервис должен быть в статусе "active (running)"
```

