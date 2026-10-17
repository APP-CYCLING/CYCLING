# Compilaciones Android

| Perfil EAS | Nombre instalado | Paquete | Uso |
| --- | --- | --- | --- |
| development | Cycling Dev | com.cycling.app.dev | Desarrollo con Metro |
| preview | Cycling Preview | com.cycling.app | APK independiente para compartir |

Ambas se pueden instalar juntas. Comparten el proyecto EAS y el backend actual,
pero cada instalación tiene sus propios datos locales y sesión.
Preview conserva el identificador anterior; actualiza esa instalación si la firma
es la misma. Development usa una instalación separada.

## Crear los APK

Desde la raíz del repositorio, en PowerShell:

```powershell
Set-Location apps/mobile
corepack pnpm dlx eas-cli build --platform android --profile development
corepack pnpm dlx eas-cli build --platform android --profile preview
```

Al terminar cada compilación EAS proporciona un enlace para descargar e instalar
el APK. Comparte el enlace de **preview** con quienes probarán la aplicación.
En la primera compilación de development, EAS puede solicitar crear una firma
Android para el nuevo paquete; permite generar su keystore si aún no existe.

Los entornos EAS `development` y `preview` deben tener configuradas las variables
públicas requeridas por la aplicación: `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_MAPTILER_KEY`.
El archivo local `.env` no sustituye la configuración de variables en EAS.
`GEOAPIFY_API_KEY` continúa únicamente en los secretos del servidor Supabase.

## Trabajar con Cycling Dev

Después de instalar el APK development, desde la raíz:

```powershell
corepack pnpm dev
```

El script selecciona automáticamente `APP_VARIANT=development` y el esquema
`cycling-dev`, también en Windows. Abre Cycling Dev y conecta con Metro.
Cycling Preview no necesita Metro ni una computadora encendida; necesita Internet
para los servicios remotos de mapas y Supabase.

`app.config.js` combina la configuración compartida de `app.json` con la variante
seleccionada por cada perfil de `eas.json`. Si no se especifica `APP_VARIANT`,
se utiliza preview. Los identificadores iOS no se modifican en esta configuración.
Los cambios de paquete, nombre y configuración nativa requieren nuevas compilaciones.
