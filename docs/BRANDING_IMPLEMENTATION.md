# Branding oficial de CYCLING

## Kit utilizado

El kit está en `diseño/branding-cycling/` en este checkout; no existe `design/branding-cycling/`. Se revisaron todas sus carpetas, `06_GUIDES/PROMPT_PARA_CODEX.md`, las guías complementarias, ejemplos de componentes, logos, iconos, splash, GIF, marketing y referencias. Los originales se conservan intactos.

Los recursos necesarios están en `apps/mobile/assets/branding/`. Se retuvieron 54 archivos: seis variantes de logo, icono APK, dos máscaras adaptativas preparadas, dos splash estáticos preparados, dos GIF originales seleccionados, 40 fotogramas PNG y su manifiesto. Marketing, referencias y previsualizaciones permanecen fuera de los assets de ejecución.

## Identidad y tema del teléfono

- `ThemeProvider` utiliza una preferencia local de CYCLING: claro por defecto y oscuro al activar el interruptor en Perfil → Configuración y seguridad. El tema del teléfono no modifica esta selección. Véase [apariencia](APPEARANCE.md).
- Colores oficiales: lima `#A7F55B`, negro `#0F1210` y blanco `#FFFFFF`. Fondos, superficies, bordes, texto, errores, formularios, encabezados, pestañas y modales tienen variantes clara y oscura. Los botones lima conservan texto negro por contraste.
- `BrandLogo` conserva los PNG, proporciones y tipografía originales. Admite horizontal, emblema y monocromático; la apariencia se selecciona según el tema o un fondo explícito.
- El PNG horizontal que el kit llama «sobre fondo claro» tiene letras blancas. Para mantener la C verde/blanca y las letras legibles, en tema claro se componen los **dos PNG oficiales**: tipografía de la variante negra y símbolo de la variante de color. Sus máscaras alfa son idénticas; la separación transparente está entre x=653 y x=674 sobre un lienzo de 2172 px. El recorte de presentación termina al 30,5 %, dentro de ese espacio. No se redibuja el logo ni se sustituye su fuente.
- En encabezados se sustituyó la bicicleta con texto CYCLING. En autenticación se sustituyó el logo temporal. El arranque ya no dibuja una letra C. Los avatares personales conservan sus iniciales; el avatar sin nombre utiliza el emblema oficial. Actividad lo utiliza también en su estado vacío.

No se modifica el estilo cartográfico de MapTiler: el mapa conserva su presentación y atribuciones; los controles y paneles React Native que lo rodean sí siguen el tema. No se modificaron los archivos del motor MapLibre, servicios de mapas, Geoapify, Supabase, GPS, navegación ni lógica de negocio.

## Tres momentos de arranque y carga

| Momento | Implementación |
| --- | --- |
| Splash nativo | `expo-splash-screen` SDK 57, imagen PNG estática y fondo claro fijo, independiente del teléfono. El recorte central de `03_SPLASH` conserva símbolo y tipografía, excluyendo la barra ilustrativa de progreso. |
| Inicialización React Native | `StartupScreen`: logo oficial, texto nativo, scroll para pantallas pequeñas/tamaño de texto ampliado, tema y loader. Se mantienen el límite de espera de fuentes y la recuperación de sesión existentes. El splash se oculta al disponer de contenido nativo visible. |
| Carga interna | `BrandLoader`, reutilizado por `Busy` y por el arranque. No presenta porcentajes ficticios. |

## BrandLoader y GIF

API disponible:

```tsx
<BrandLoader size="small" />
<BrandLoader size="medium" message="Cargando tus recorridos…" />
<BrandLoader size="large" fullScreen />
<BrandLoader variant="dark" message="Preparando la app…" />
<BrandLogo width={170} />
<BrandLogo variant="emblem" width={36} />
<BrandLogo theme="dark" monochrome />
```

Tamaños: pequeño 48, mediano 112 y grande 192. El fondo de pantalla completa y el mensaje siguen el tema. `variant="light" | "dark"` permite ajustarlo a un fondo específico.

Se prioriza `compact-loader-dark.gif`, con las líneas verdes de velocidad: 16 fotogramas, 80 ms cada uno, ciclo de 1280 ms. Para claro se utiliza `loading-light.gif`: 24 fotogramas, 70 ms cada uno, ciclo de 1680 ms. Ambos originales tienen repetición continua.

No se depende del soporte GIF de Fresco en Android. Los fotogramas del kit se exportaron a PNG RGBA de 192×192 y Reanimated, ya instalado, cambia su visibilidad en bucle. Se conserva el arte y el movimiento originales. Esto evita instalar un decodificador o una biblioteca de imágenes nueva. Los GIF originales seleccionados también se conservan en `04_GIFS`, pero **no se reproducen directamente ni se usan dentro del splash nativo**.

Al activar reducción de movimiento se muestra un emblema estático. Se escuchan cambios de accesibilidad en vivo y se evita que una consulta inicial tardía anule la preferencia nueva. La animación se cancela en segundo plano y al desmontar el componente.

## Recursos nativos

| Recurso | Dimensiones | Preparación |
| --- | --- | --- |
| Icono principal | 1024×1024 | PNG oficial, sin deformarlo. |
| Adaptive foreground | 1024×1024 RGBA | Copia con margen transparente; el original llenaba casi todo el lienzo. Arte dentro de x=192…831, y=200…832. |
| Adaptive monocromático | 1024×1024 RGBA | Máscara blanca oficial con margen; x=192…831, y=200…822. Alfa 0…255. |
| Splash claro / oscuro | 960×960 | Recorte (141,700)–(1101,1660) de los originales 1242×2688; sin barra de progreso ilustrativa. |
| Horizontal | 2172×724 | Proporción 3:1, sin modificar tipografía. |
| Emblemas | 1254×1254 | Proporción 1:1 y transparencia conservada. |

La configuración compartida de `app.json` mantiene el branding y Expo SDK 57; `userInterfaceStyle` ahora es `light`. `app.config.js` selecciona Cycling Dev (`com.cycling.app.dev`) o Cycling Preview (`com.cycling.app`) según el perfil de `eas.json`, manteniendo el proyecto EAS. Véanse [variantes de compilación](BUILD_VARIANTS.md), [apariencia](APPEARANCE.md) y [permisos de grabación en segundo plano](BACKGROUND_RECORDING.md) para los cambios posteriores a la integración inicial del branding.

No hay notificaciones implementadas en el proyecto. No se instaló un SDK ni se cambió esa funcionalidad; sus iconos oficiales siguen disponibles en el kit original. El icono monocromático lo utiliza el launcher en sistemas compatibles cuando el usuario activa iconos temáticos.

## Archivos nuevos

- `apps/mobile/src/shared/components/BrandLogo.tsx`
- `apps/mobile/src/shared/components/BrandLoader.tsx`
- `apps/mobile/src/shared/components/brand-motion.ts`
- `apps/mobile/src/shared/theme/ThemeContext.tsx`
- Recursos seleccionados y preparados bajo `apps/mobile/assets/branding/`
- `scripts/branding.test.cjs`
- Este documento.

## Archivos modificados

| Área | Archivos |
| --- | --- |
| Configuración | `apps/mobile/app.json`, `apps/mobile/package.json`, `pnpm-lock.yaml`, `package.json` |
| Arranque y pestañas | `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx` |
| Componentes compartidos | `shared/components/StartupScreen.tsx`, `UI.tsx`, `DesignSystem.tsx`, `AppText.tsx`; `shared/theme/colors.ts` |
| Autenticación | `modules/auth/components/AuthChrome.tsx`, `AuthInput.tsx`; `modules/auth/screens/AuthScreen.tsx` |
| Inicio y catálogo | `modules/home/screens/HomeScreen.tsx`; `modules/routes/components/RouteCard.tsx` |
| Perfil | `modules/profile/components/ProfileUI.tsx`; `modules/profile/screens/ProfileScreen.tsx`, `EditProfileScreen.tsx` |
| Actividad y Pedalear | `modules/rides/screens/ActivityScreen.tsx`; `modules/rides/components/ActivityChart.tsx`, `ActivityRideCard.tsx`, `ActivityDetail.tsx`, `RideCard.tsx`, `RideLayout.tsx`, `SaveRideDialog.tsx` |
| Paneles de mapa | `modules/maps/components/PlannerLayout.tsx`, `CyclingMap.tsx`, `CyclingMap.web.tsx`; `modules/navigation/components/LiveNavigationPanel.tsx` |
| Pruebas existentes | `scripts/startup.test.cjs`, `scripts/ride-saving.test.cjs`: adaptadas al contexto visual sin quitar comprobaciones de arranque o conservación del mapa. |

Las rutas abreviadas `shared/` y `modules/` parten de `apps/mobile/src/`.

## Verificaciones realizadas

- TypeScript correcto y **82 pruebas aprobadas**. Las nuevas pruebas comprueban apariencia, contraste, variantes y proporciones, fotogramas, reducción de movimiento, pausa en segundo plano y referencias nativas a assets existentes.
- `expo install --check`: dependencias compatibles y actualizadas para el SDK instalado.
- `expo config --type introspect`: plugin válido, recursos adaptativos/monocromáticos, apariencia automática e iOS `UIUserInterfaceStyle=Automatic`.
- Exportación Metro/Hermes Android e iOS correcta con 110 recursos, sin marketing en el bundle.
- Dimensiones, alfa, márgenes y duración/repetición de los GIF comprobados con Pillow. Inspección visual de los recursos claros/oscuros y del recorte de splash. No se presenta esa inspección como capturas de la app.
- Se compararon hashes de 15 archivos de backend y mapas con su estado al iniciar la tarea: sin cambios. No se ejecutaron migraciones ni despliegues.

## Recompilar y revisar en teléfono

**Es necesario recompilar e instalar la APK** para ver el icono y splash nuevos. Recargar Metro no aplica cambios de recursos nativos.

Desde `apps/mobile`, para una APK de revisión sin dev client:

```powershell
corepack pnpm dlx eas-cli build --platform android --profile preview
```

Para continuar desarrollo con Metro, usar `--profile development`, instalar la APK nueva y arrancar desde la raíz:

```powershell
corepack pnpm --filter @cycling/mobile exec expo start --dev-client --clear
```

Se mantienen los entornos EAS existentes; la compilación debe disponer de las mismas variables públicas que usa actualmente la app. No se ha iniciado una compilación EAS ni generado una APK durante esta tarea.

Pendiente: instalar una compilación nueva en Android/iOS y verificar arranque real, cambio de tema con la app abierta, launcher, accesibilidad y fluidez del loader en dispositivo. El splash final debe revisarse en una compilación standalone/preview: [Expo explica las diferencias respecto a Expo Go y development builds](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
