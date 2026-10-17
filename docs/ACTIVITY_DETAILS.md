# Actividades, rutas y fotos

Implementación del 16/10/2026. Se modifica la app existente; el mapa sigue siendo MapLibre nativo con MapTiler. Las funciones Geoapify y Overpass no se modifican.

## Comportamiento

- Al comenzar una salida se captura la ruta calculada y el destino. Al finalizar se guardan junto con el GPS, nombre, fechas, métricas y último punto. Los cambios posteriores del planificador no sustituyen ese plan.
- Historial y detalle muestran la ruta prevista en lima, el recorrido GPS en azul, A como inicio, B como destino y F naranja como último punto registrado. El encuadre incluye ambos trazados, con un mínimo de contexto para que unos pocos metros de GPS no llenen el mapa.
- El servidor clasifica una salida planificada como completada si el último punto está a 50 m o menos del destino y se registró al menos el 80 % de la distancia prevista. Es una estimación de llegada, no una verificación de cada calle. Una salida sin plan se identifica como libre; sin datos suficientes no se afirma que esté completada.
- Las actividades anteriores conservan su GPS. La ruta prevista que nunca se guardó no se puede recuperar ni se inventa; su llegada figura como desconocida.
- Se pueden seleccionar hasta 6 fotos JPG/PNG/WebP de hasta 5 MB cada una, antes de guardar o desde el detalle. El bucket es privado: cada usuario solo accede a fotos de actividades propias. Se usan URLs temporales de una hora; «Actualizar galería» permite renovarlas.
- Si falla una foto después de guardar el recorrido, el formulario conserva el ID de la actividad y los archivos ya enviados. Reintentar no crea otro recorrido. Mantener la app abierta hasta terminar: los borradores pendientes no se recuperan después de cerrar el proceso.
- «Volver a hacer este recorrido» abre Explorar con el destino anterior y el origen GPS actual, para volver a calcular. Para actividades antiguas sin destino, se propone el último punto registrado y se explica en pantalla. No se promete que la nueva ruta tenga exactamente las mismas calles.
- Búsqueda, rutas y ciclovías tienen mensajes diferenciados y reintento. El plazo total de 35 s incluye la recuperación de sesión, la petición y lectura de respuesta. Un fallo de ciclovías deja disponible la ruta calculada.

## Activación pendiente (no ejecutada)

1. Aplicar `supabase/migrations/202610160004_ride_details.sql` en el SQL Editor del proyecto **cycling**, después de comprobar que `202610160003_ride_names.sql` ya está aplicada. Ejecutar únicamente el archivo 004, completo. Si 003 falta, aplicar primero 003. No ejecutar `db push` con todo el historial sin reconciliar previamente las migraciones que se aplicaron manualmente.
2. Crear e instalar una nueva compilación de desarrollo por los nuevos módulos nativos `expo-image-picker` y `expo-file-system`. Con Android SDK local: `corepack pnpm android`. Alternativa EAS, desde `apps/mobile`: `corepack pnpm dlx eas-cli build --platform android --profile development`; instalar el APK resultante.
3. Reiniciar Metro desde la raíz: `corepack pnpm --filter @cycling/mobile exec expo start --dev-client --clear`. Abrir la nueva compilación instalada.

El archivo 004 añade columnas, un RPC autenticado que reutiliza las validaciones existentes y un bucket privado con políticas por propietario y actividad. Mantiene las funciones y filas anteriores. No se ejecutó ninguna migración ni cambio en la base de datos durante esta implementación. Las tres Edge Functions se consultaron mediante CLI y constan ACTIVE; no se dispone de una sesión del usuario móvil para reproducir su petición autenticada.

## Archivos de esta corrección

| Área | Archivos |
| --- | --- |
| Contratos y persistencia | `packages/contracts/src/index.ts`, `apps/mobile/src/shared/supabase/mappers.ts`, `apps/mobile/src/modules/rides/services/rides.service.ts`, `supabase/migrations/202610160004_ride_details.sql` |
| Registro y formulario | `apps/mobile/src/modules/rides/hooks/useRideController.ts`, `apps/mobile/src/modules/rides/components/SaveRideDialog.tsx` |
| Componentes nuevos | `apps/mobile/src/modules/rides/components/ActivityDetail.tsx`, `apps/mobile/src/modules/rides/components/PhotoDraftPicker.tsx` |
| Historial y mapas | `apps/mobile/src/modules/rides/screens/ActivityScreen.tsx`, `apps/mobile/src/modules/rides/components/ActivityRideCard.tsx`, `apps/mobile/src/modules/rides/components/RecordedRideMap.tsx`, `apps/mobile/src/modules/maps/components/NativeCyclingMap.tsx`, `apps/mobile/src/modules/maps/types/map.types.ts`, `apps/mobile/src/modules/maps/utils/geometry.ts` |
| Fotos privadas | `apps/mobile/src/modules/rides/services/ride-photos.service.ts`, `apps/mobile/app.json`, `apps/mobile/package.json`, `pnpm-lock.yaml` |
| Repetir una salida | `apps/mobile/src/modules/navigation/services/repeat-ride.store.ts`, `apps/mobile/src/modules/maps/hooks/useMapPlanner.ts` |
| Red y reintentos | `apps/mobile/src/shared/services/map-functions.ts`, `apps/mobile/src/modules/maps/components/PlannerLayout.tsx`, `apps/mobile/src/modules/route-planner/hooks/useDestinationSearch.ts`, `apps/mobile/src/modules/bike-lanes/hooks/useVisibleBikeLanes.ts` |
| Validación | `scripts/ride-details.test.cjs`, `scripts/ride-saving.test.cjs`, `package.json` |

## Verificación

TypeScript; suite automatizada con 64 pruebas; exportación Metro/Hermes Android e iOS. Las pruebas comprueban planes MultiLineString sin conexiones ficticias, registros antiguos, zoom de recorridos cortos, cancelación y tiempos de espera, errores HTTP, URLs firmadas, formatos/tamaños de fotos y reintento parcial sin duplicados.

Pendiente en un teléfono y Supabase tras activar 004: grabar una ruta completa y otra detenida antes del destino; comprobar encuadre y F; añadir fotos al finalizar y desde el detalle; volver a abrir y comprobar que persisten; repetir desde una ubicación distinta; desconectar/reconectar red y reintentar; comprobar con dos usuarios distintos que no puedan acceder a fotos ajenas. No se ha ejecutado la migración en un PostgreSQL de prueba ni se ha comprobado el GPS o el selector de imágenes en un dispositivo.
