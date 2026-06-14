# VizHub AR (Android APK)

Мобильное приложение: каталог → «Примерить в AR» (следующий этап).

## Сборка APK

```bash
cd mobile
npm install

# 1) Аккаунт Expo (бесплатно): https://expo.dev/signup
#    или: npx eas-cli register

# 2) Вход (если пароль не подходит — сброс на expo.dev или SSO):
npx eas-cli login
# npx eas-cli login --sso

# 3) Создать проект на Expo (один раз) — получит настоящий projectId UUID
npx eas-cli init

# 4) Сборка APK в облаке Expo (~10–20 мин)
npm run build:apk
```

APK скачивается из EAS. Загрузите на сервер и укажите в `.env` backend:

```
MOBILE_APK_DOWNLOAD_URL=https://www.vizhub.pro/downloads/vizhub-ar.apk
```

**На VPS** (после сборки APK):

```bash
# Вариант 1: скопировать файл с ПК
scp vizhub-ar.apk deploy@vrwbspxnst:~/sofa-marketplace/frontend/public/downloads/

# Вариант 2: на сервере из URL Expo
bash deploy/upload-mobile-apk.sh --url 'https://expo.dev/artifacts/eas/....apk'

# Проверка (используйте www — SSL выдан для www.vizhub.pro)
curl -I https://www.vizhub.pro/downloads/vizhub-ar.apk
# Должен быть HTTP 200 от nginx, не 404 от Next.js
```

Файл: `frontend/public/downloads/vizhub-ar.apk`.

**Важно:** frontend собран с `output: 'standalone'` — APK, добавленный после `npm run build`, Next.js не отдаёт.
Добавьте в nginx блок `location /downloads/` (см. `deploy/nginx-frontend.conf.example`) **или** выполните:

```bash
node frontend/scripts/sync-standalone-downloads.cjs
sudo systemctl restart sofa-frontend
```

На сайте: `/app-download` — кнопка скачивания.

## Локальная разработка

```bash
EXPO_PUBLIC_API_URL=https://api.vizhub.pro npm start
```

## AR (ViroReact + ARCore)

In-app AR с детекцией пола (plane detection):

- `@reactvision/react-viro` + `newArchEnabled: true`
- Наведите на пол → коснитесь плоскости → модель GLB появится на полу
- Жесты: перетаскивание, щипок (масштаб), поворот

**Не работает в Expo Go** — только dev build / EAS APK:

```bash
npm run build:apk
```

См. [docs/MOBILE_AR_APP.md](../docs/MOBILE_AR_APP.md).
