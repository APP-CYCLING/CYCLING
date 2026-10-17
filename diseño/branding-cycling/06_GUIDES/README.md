# CYCLING — Brand Kit actualizado

Este kit incluye todo lo necesario para aplicar la identidad visual actualizada de **CYCLING** con la nueva tipografía seleccionada: moderna, deportiva, futurista y coherente con el símbolo.

## Qué incluye

- Logos en distintas versiones y fondos.
- Iconos para APK / launcher en varios tamaños.
- Foreground para Android Adaptive Icon.
- Splash screens dark y light.
- GIFs de carga con más detalle y movimiento.
- Piezas de marketing para vender/promocionar la app.
- Guías de uso e instrucciones para Codex / Expo.

## Carpeta recomendada dentro del proyecto

```
apps/mobile/assets/branding/
  logos/
  icons/
  splash/
  gifs/
  marketing/
```

## Uso rápido

1. Copia los archivos de `01_LOGO`, `02_APP_ASSETS`, `03_SPLASH` y `04_GIFS` a `apps/mobile/assets/branding/`.
2. Revisa `06_GUIDES/APP_JSON_SNIPPET.json`.
3. Usa `07_CODE/components/BrandLoader.tsx` para mostrar el GIF mientras se cargan datos.
4. Usa `06_GUIDES/PROMPT_PARA_CODEX.md` para pedirle a Codex que implemente todo.

## Notas importantes

- El **splash nativo** debe usar imagen estática.
- Los **GIFs** son para pantallas internas de carga dentro de la app.
- El logo horizontal se recomienda en headers, login, onboarding y piezas comerciales.
- El icono cuadrado se recomienda para APK, launcher, favicon y avatar de marca.
