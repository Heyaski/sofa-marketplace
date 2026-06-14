# VizHub AR — мобильное приложение (Android / iOS)

MVP: список товаров → кнопка **«Примерить»** → камера AR → модель на полу/углах или в точке, выбранной пользователем.

## Стек (рекомендация)

| Слой | Технология |
|------|------------|
| UI | **Expo (React Native)** + TypeScript |
| Навигация | expo-router |
| API | тот же backend (`/api/catalog/products/`, JWT) |
| AR iOS | **ARKit** через `@reactvision/react-viro` или **Expo + native module** |
| AR Android | **ARCore** через `@reactvision/react-viro` (plane detection, in-app) |
| 3D | GLB / USDZ (для iOS Quick Look fallback) |

## Экраны MVP

1. **Login** — email/password или JWT с сайта  
2. **Catalog** — список товаров с превью (как на сайте)  
3. **Product** — карточка + кнопка «Примерить в AR»  
4. **AR View** — камера, плоскость пола, размещение модели:
   - авто-привязка к углу комнаты (plane + anchor);
   - ручной tap — пользователь ставит модель в точку;
   - жесты: масштаб, поворот.

## API

- `GET /api/products/?list_mode=3d` — каталог с 3D
- `GET /api/products/{id}/` — `model_glb`, `model_ar_glb`, `model_usdz`
- Авторизация: Bearer JWT (как веб)

## Создание проекта

```bash
cd mobile
npx create-expo-app@latest . --template tabs
npm install expo-router axios @react-native-async-storage/async-storage
# AR (после выбора библиотеки):
# npm install @reactvision/react-viro
```

## Этапы

| Этап | Срок | Результат |
|------|------|-----------|
| 1 | 1–2 нед | Expo, login, список товаров |
| 2 | 2–3 нед | AR-сцена, plane detection, одна GLB |
| 3 | 1–2 нед | Ручное размещение + авто-угол |
| 4 | 1 нед | TestFlight + Google Play internal |

## Папка `mobile/`

Стартовая структура — см. `mobile/package.json`. Полный AR-код — отдельная ветка после утверждения библиотеки (Viro vs Filament vs Unity embed).
