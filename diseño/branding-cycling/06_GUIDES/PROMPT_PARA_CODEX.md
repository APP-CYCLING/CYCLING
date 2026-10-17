Actúa como un Senior React Native / Expo Engineer.

Quiero que implementes el branding actualizado de la app CYCLING usando los archivos dentro de `design/branding-cycling/` o la carpeta donde copie este kit.

## Objetivos
1. Aplicar el nuevo logo horizontal con tipografía deportiva/futurista seleccionada.
2. Usar el icono cuadrado como ícono principal de la app.
3. Configurar el adaptive icon de Android con el foreground incluido.
4. Configurar splash screen estático dark.
5. Integrar los GIFs de carga para loaders internos.
6. Mantener la arquitectura modular existente.

## Assets clave
- `01_LOGO/logo-horizontal-transparente.png`
- `01_LOGO/logo-emblema-transparente.png`
- `02_APP_ASSETS/icons/icon-1024.png`
- `02_APP_ASSETS/adaptive/adaptive-foreground-1024.png`
- `03_SPLASH/splash-dark-1242x2688.png`
- `04_GIFS/loading-dark.gif`
- `04_GIFS/loading-light.gif`

## Tareas
- Actualiza `app.json` o `app.config.ts`.
- Crea un componente global reutilizable `BrandLoader`.
- Reemplaza logos previos en login, headers y lugares de branding.
- Usa el logo horizontal en pantallas amplias y el emblema en espacios reducidos.
- No toques la lógica de negocio de mapas, Supabase ni rutas.
- Entrega listado de archivos modificados y cualquier paso que requiera recompilar.
