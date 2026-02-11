# Настройка ЮКассы для vizhub.pro

## 1. Получение ключей в личном кабинете ЮКассы

1. Зайди на [https://yookassa.ru/](https://yookassa.ru/) и авторизуйся
2. Перейди в **Настройки** → **Ключи API** (или **Способы подключения**)
3. Скопируй:
   - **Shop ID** (идентификатор магазина) → это `YOOKASSA_ACCOUNT_ID`
   - **Секретный ключ** → это `YOOKASSA_SECRET_KEY`

**Тестовый режим:** в кабинете можно переключать режим. Для тестов есть отдельные ключи.

---

## 2. Добавление в .env на сервере

Подключись по SSH и отредактируй `.env`:

```bash
nano ~/sofa-marketplace/backend/.env
```

Добавь или обнови строки (подставь свои значения):

```
# ЮКасса
YOOKASSA_ACCOUNT_ID=1220055
YOOKASSA_SECRET_KEY=live_QIY1YqFB1smIajcfNL-c70HYKG555qtF3wjlScgiAu4
YOOKASSA_TEST_MODE=0
```

- **YOOKASSA_TEST_MODE=1** — тестовый режим (оплаты не списываются)
- **YOOKASSA_TEST_MODE=0** — боевой режим

Опционально, URL возврата после оплаты:

```
YOOKASSA_RETURN_URL=https://www.vizhub.pro/profile/subscription?payment_success=true
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## 3. Перезапуск backend

```bash
sudo systemctl restart sofa-backend
```

---

## 4. Вебхук (для автоматического подтверждения платежей)

В личном кабинете ЮКассы:
- **Настройки** → **Уведомления** (Notifications)
- Укажи URL вебхука: `https://api.vizhub.pro/api/subscriptions/yookassa/webhook/`
- Выбери события: успешная оплата, возврат и т.п.

---

## 5. Проверка

После настройки попробуй оформить подписку на сайте. Должна открыться страница оплаты ЮКассы.
