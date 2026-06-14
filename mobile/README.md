# VizHub AR (Android APK)

Мобильное приложение: каталог → «Примерить в AR» (следующий этап).

## Сборка APK

```bash
cd mobile
npm install
npx eas login
npx eas build:configure
npm run build:apk
```

APK скачивается из EAS. Загрузите на CDN/S3 и укажите в `.env` сервера:

```
MOBILE_APK_DOWNLOAD_URL=https://vizhub.pro/downloads/vizhub-ar.apk
```

На сайте: `/app-download` — кнопка скачивания.

## Локальная разработка

```bash
EXPO_PUBLIC_API_URL=https://api.vizhub.pro npm start
```

## AR (этап 2)

- Android: ARCore plane detection + GLB
- iOS не в scope (только APK по ТЗ заказчика)

См. [docs/MOBILE_AR_APP.md](../docs/MOBILE_AR_APP.md).
