# CYCLING — implementación de Stitch

## Correspondencia de los archivos exportados

Se revisaron los cinco `code.html`, sus cinco `screen.png` y `velocita_urban_mobility/DESIGN.md` de `diseño/`. Se analizaron estilos, tipografía, controles, textos, imágenes remotas y SVG ilustrativos. Los HTML no se incluyen como WebViews.

| Exportación                          | Implementación en la aplicación                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `explorar_mapa_ciclista_interactivo` | Pestaña Explorar: buscador flotante, filtros funcionales, controles y panel sobre MapLibre.                    |
| `inicio_dashboard_ciclista`          | Inicio: saludo con el usuario real, accesos, resumen semanal, rutas y últimos recorridos.                      |
| `planificaci_n_de_ruta`              | Estado de planificación en Explorar al elegir un destino: origen/destino, distancia, tiempo, cálculo e inicio. |
| `pedalear_grabaci_n_en_vivo`         | Pedalear: cronómetro, velocidad media, distancia, precisión, mapa y controles del registro.                    |
| `navegaci_n_activa_en_vivo`          | Vista ampliada de mapa dentro de Pedalear: destino y ruta de referencia, métricas y controles.                 |
| `velocita_urban_mobility/DESIGN.md`  | Colores, Inter, tarjetas redondeadas, jerarquía tipográfica, controles circulares y tratamiento del trazado.   |

Actividad y Perfil ya cuentan con exportaciones propias y se añadió Editar perfil. Su implementación posterior, archivos y validaciones se detallan en [STITCH_PROFILE_ACTIVITY.md](STITCH_PROFILE_ACTIVITY.md).

## Componentes y organización

Los archivos de Expo Router siguen siendo los puntos de entrada. Las pantallas y la presentación viven en los módulos. `useMapPlanner` y `useRideController` contienen la coordinación que antes estaba en las pantallas; mantienen los hooks y servicios existentes.

Componentes compartidos nuevos: `AppText`, `ScreenHeader`, `Avatar`, `IconButton`, `Chip`, `MetricTile` y `SectionHeading`. Se actualizaron los componentes globales de `UI.tsx` y `RouteCard`. Los nuevos `RideCard`, `PlannerLayout` y `RideLayout` se reutilizan en sus módulos.

Las áreas seguras se conservan por encima del contenido desplazable. La barra inferior considera el inset del sistema; las páginas limitan el ancho de lectura en tabletas. El panel del planificador ajusta su altura al espacio real disponible y permite desplazarse para acceder a errores y acciones.

## Archivos creados

- `apps/mobile/src/shared/theme/typography.ts`
- `apps/mobile/src/shared/components/AppText.tsx`
- `apps/mobile/src/shared/components/DesignSystem.tsx`
- `apps/mobile/src/modules/home/screens/HomeScreen.tsx`
- `apps/mobile/src/modules/profile/screens/ProfileScreen.tsx`
- `apps/mobile/src/modules/rides/screens/ActivityScreen.tsx`
- `apps/mobile/src/modules/rides/hooks/useRideHistory.ts`
- `apps/mobile/src/modules/rides/hooks/useRideController.ts`
- `apps/mobile/src/modules/rides/components/RideCard.tsx`
- `apps/mobile/src/modules/rides/components/RideLayout.tsx`
- `apps/mobile/src/modules/maps/hooks/useMapPlanner.ts`
- `apps/mobile/src/modules/maps/components/PlannerLayout.tsx`
- `apps/mobile/assets/fonts/Inter_400Regular.ttf`
- `apps/mobile/assets/fonts/Inter_600SemiBold.ttf`
- `apps/mobile/assets/fonts/Inter_700Bold.ttf`
- `apps/mobile/assets/fonts/Inter_800ExtraBold.ttf`
- `apps/mobile/assets/fonts/LICENSE` y `LICENSE_FONT`
- `apps/mobile/assets/images/stitch/route-1.jpg`, `route-2.jpg` y `route-3.jpg`
- `apps/mobile/assets/images/stitch/README.md`
- `docs/STITCH_IMPLEMENTATION.md`

## Archivos modificados

- `apps/mobile/src/app/_layout.tsx`: carga local de Inter.
- `apps/mobile/src/app/(tabs)/_layout.tsx`: barra inferior y áreas seguras.
- `apps/mobile/src/app/(tabs)/index.tsx`: entrada del módulo Inicio.
- `apps/mobile/src/app/(tabs)/activity.tsx`: entrada del módulo Actividad.
- `apps/mobile/src/app/(tabs)/profile.tsx`: entrada del módulo Perfil.
- `apps/mobile/src/shared/theme/colors.ts`: paleta de Stitch.
- `apps/mobile/src/shared/components/UI.tsx`: componentes globales.
- `apps/mobile/src/modules/routes/components/RouteCard.tsx`: tarjeta y fotografías ilustrativas.
- `apps/mobile/src/modules/maps/screens/MapPlannerScreen.tsx`: composición del planificador.
- `apps/mobile/src/modules/maps/components/NativeCyclingMap.tsx`: trazado lima con borde negro y marcador de ubicación.
- `apps/mobile/src/modules/rides/screens/RideScreen.tsx`: composición de Pedalear.

## Funcionalidad conservada

- Autenticación y cierre de sesión mediante Supabase.
- Servicios, consultas, Edge Functions, cuotas, caché y políticas existentes. Esta implementación no ejecutó migraciones ni despliegues.
- MapLibre nativo, estilo MapTiler, créditos cartográficos e infraestructura OSM.
- Búsqueda y cálculo mediante Geoapify.
- Ubicación actual como origen inicial, reintentos GPS, ajustes de permisos y origen manual opcional.
- Origen capturado junto a la geometría al calcular una ruta; comenzar en Pedalear conserva ese plan.
- Registro GPS, filtro de precisión, distancia, cronómetro y guardado real del recorrido.
- Detención al cambiar de pantalla o pasar a segundo plano y opción para guardar el recorrido detenido.
- Estados de carga, error, permisos, invitado y ausencia de rutas/actividades; reintentos disponibles.

El historial mantiene el límite existente de 100 recorridos. Los resúmenes indican ese límite cuando corresponde. Las respuestas tardías del historial se descartan al perder foco y los datos se separan por usuario.

## Diferencias y funciones pendientes

Los números y controles ficticios de los ejemplos no se presentan como funcionalidades reales:

- Clima, seguridad en porcentajes, altimetría y perfil de elevación requieren fuentes de datos adicionales. El desnivel del planificador indica «sin datos».
- Cadencia, potencia, calorías y batería no se simulan; se muestran precisión GPS y puntos registrados.
- La velocidad visible es **media** (distancia registrada / tiempo), no velocidad instantánea.
- La vista de ruta no ofrece maniobras giro a giro, voz, recálculo automático ni ETA en vivo.
- Pausa/reanudación, vueltas y bloqueo de controles del diseño requieren ampliar el registro. El control principal actual inicia o finaliza/guarda con confirmación.
- Favoritos, destinos personales guardados, cambio de modo urbano/carretera/e-bike y alternativas múltiples requieren funcionalidad adicional. Se conservan bicicleta y una ruta real calculada.
- Las fotos de las tarjetas son imágenes ilustrativas del export, identificadas como tales. El avatar usa las iniciales del usuario; no se atribuye a la cuenta la foto de la persona de ejemplo.

## Validaciones

- `corepack pnpm --filter @cycling/mobile check`: TypeScript correcto.
- `corepack pnpm test`: 26 pruebas correctas, incluyendo GPS, origen de rutas, geometrías, normalización del estilo, autenticación y cuotas de las funciones.
- `corepack pnpm dlx expo-doctor` desde `apps/mobile`: 21/21 comprobaciones correctas.
- Exportación Metro/Hermes para Android: correcta en `.expo/stitch-android-validation`.
- Servidor web local: responde HTTP 200. La versión web conserva su aviso de que el mapa requiere el cliente nativo.
- Exportación Metro/Hermes para iOS: correcta en `.expo/stitch-ios-validation`.

No hubo una superficie de navegador ni un dispositivo conectado disponible para revisión visual en ejecución. Faltan verificar físicamente Android/iOS, tamaños pequeños, fuente ampliada, teclado, permisos GPS, selección de destino y guardado de una salida real. Una exportación JS correcta no sustituye una compilación nativa ni esa prueba física.
