# Implementación en Expo / React Native

## 1. Copiar assets

Copia estas carpetas a `apps/mobile/assets/branding/`:

- `01_LOGO`
- `02_APP_ASSETS`
- `03_SPLASH`
- `04_GIFS`
- `05_MARKETING` (opcional)

## 2. Configurar Expo

Revisa `APP_JSON_SNIPPET.json` y actualiza tu `app.json` o `app.config.ts`.

## 3. Usar el loader animado

Importa `BrandLoader.tsx` y úsalo en vistas donde cargues datos:

```tsx
import { BrandLoader } from '../components/BrandLoader';

if (isLoading) {
  return <BrandLoader message="Cargando rutas..." variant="dark" />;
}
```

## 4. Recompilar

Si cambias icono, splash o adaptive icon, recompila una APK/development build:

```powershell
eas build --platform android --profile development
```
