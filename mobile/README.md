# VizHub AR (Android APK + iOS)

Мобильное приложение: каталог → «Примерить в AR».

## Сборка Android (APK)

```bash
cd mobile
npm install
npx eas-cli login
npm run build:apk
```

APK загрузите на сервер:

```bash
bash deploy/upload-mobile-apk.sh /path/to/vizhub-ar.apk
```

В `backend/.env`:

```
MOBILE_APK_DOWNLOAD_URL=https://www.vizhub.pro/downloads/vizhub-ar.apk
```

## Сборка iOS

Нужен **Apple Developer** аккаунт ($99/год).

```bash
cd mobile
npm install
npx eas-cli login

# Первый раз: привязка Apple Team ID в Expo
npx eas-cli credentials

# Сборка для TestFlight (внутренняя дистрибуция)
npm run build:ios

# После сборки — отправка в TestFlight
npx eas-cli submit -p ios --latest
```

В `backend/.env` укажите ссылку для пользователей:

```
# Бета (TestFlight) — пока нет в App Store
MOBILE_IOS_TESTFLIGHT_URL=https://testflight.apple.com/join/XXXXXXXX

# Или App Store после публикации
MOBILE_IOS_APP_STORE_URL=https://apps.apple.com/app/idXXXXXXXXX
```

Если заданы оба URL, на сайте используется **App Store**.

## Сайт

На главной кнопка **«Скачать приложение AR»** открывает выбор **Android / iOS**.

Страница `/app-download` — те же инструкции без модального окна.

## Локальная разработка

```bash
EXPO_PUBLIC_API_URL=https://api.vizhub.pro npm start
```

AR не работает в Expo Go — только dev build / EAS.

См. [docs/MOBILE_AR_APP.md](../docs/MOBILE_AR_APP.md).
