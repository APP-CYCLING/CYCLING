# Navegación en vivo

Implementada sobre MapLibre nativo y el GPS existente, sin otro watcher de ubicación ni otra app.

## Uso y alcance

1. Buscar un destino y calcular su ruta, repetir desde Actividad, o usar «Planificar desde mi ubicación» en una ruta real del catálogo. Se calcula desde el GPS actual; repetir hacia un destino no promete reproducir exactamente las mismas calles.
2. Iniciar el recorrido y pulsar **Abrir navegación en vivo** en Pedalear. Ampliar el mapa también abre esa vista. Cambiar de vista no desmonta el mapa ni detiene el registro.
3. El mapa sigue y orienta la cámara según el movimiento; el banner muestra el próximo giro en español, distancia y nombre de calle cuando está disponible. El plan aparece en lima y el recorrido GPS en azul. Se muestra el avance sobre el trazado.
4. La voz es opcional. Los avisos de aproximación se emiten una vez por etapa, dentro de 150 m, 40 m y 10 m. En una salida libre se muestra el movimiento y se puede anunciar una calle cercana, sin inventar destino ni giros.
5. Desplazar el mapa interrumpe el seguimiento; «Seguir mi movimiento» lo restaura. Un alejamiento o retroceso sostenido permite recalcular desde la posición actual. El recálculo es manual, no se consulta al proveedor por cada actualización GPS.

La calle y la infraestructura OSM se presentan como cercanas: el GPS no confirma el carril exacto. Las instrucciones requieren posición reciente (máximo 10 s) y precisión de 35 m o mejor. Se pausan cuando no se cumplen esas condiciones. Un aviso de desvío necesita tres posiciones precisas consecutivas. Llegar no finaliza ni guarda la salida automáticamente.

El recálculo actualiza la guía visible. Al guardar se conserva el plan original de la salida junto con el GPS realmente registrado. Las instrucciones se guardan dentro de `planned_route` si la migración 004 ya está aplicada; esta funcionalidad no añade otra migración.

## Backend

- `calculate-bike-route` solicita `lang=es` y `details=instruction_details,route_details`; conserva nombres, maniobras e índices por cada leg. No conecta artificialmente líneas separadas.
- Nueva función `reverse-location`: Geoapify reverse geocoding, autenticada y con la cuota de búsqueda existente. El cliente consulta como máximo una vez por minuto y tras moverse 60 m, salvo reintento explícito.
- Las ciclovías reutilizan `get-bike-lanes`, su caché y consultas acotadas. Se indica infraestructura situada a 20 m o menos como cercana.
- Desplegadas en cycling: `calculate-bike-route` v3 y `reverse-location` v1. Ambas ACTIVE; comprobado rechazo de JWT inválido con HTTP 401. Verificado `GEOAPIFY_API_KEY` configurado sin mostrar su contenido.
- No se ejecutaron migraciones ni cambios destructivos. No se dispone de la sesión del usuario móvil para reproducir peticiones autenticadas al proveedor.

Fuente del formato de instrucciones: [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/). La guía GPS local usa proyección sobre segmentos; no equivale a un SDK profesional de map matching.

## Compilación y límites

Se añadieron `expo-speech` y `expo-keep-awake`, compatibles con SDK 57. Es necesaria una **nueva compilación de desarrollo** para la voz. Se cargan de forma diferida y se avisa si el binario instalado no los incluye.

Con Android SDK local, desde la raíz: `corepack pnpm android`.

Con EAS, desde `apps/mobile`: `corepack pnpm dlx eas-cli build --platform android --profile development`; instalar el APK nuevo. Reiniciar Metro desde la raíz con `corepack pnpm --filter @cycling/mobile exec expo start --dev-client --clear`.

La pantalla se mantiene encendida mientras la navegación esté abierta y el registro activo. **Sigue funcionando en primer plano**: al salir de Pedalear o enviar la app a segundo plano se detiene el registro existente y se paran las indicaciones. Navegar con pantalla bloqueada requiere background location/foreground service, persistencia y trabajo adicional. No incluye navegación sin conexión ni obstáculos o tráfico en tiempo real. Los trazados de demostración no se usan para guiar al ciclista.

## Archivos

Nuevos: `modules/navigation/utils/live-navigation.ts`, `modules/navigation/hooks/useLiveNavigation.ts`, `modules/navigation/components/LiveNavigationPanel.tsx`, `modules/navigation/services/navigation-audio.service.ts`, `modules/routes/screens/RouteDetailScreen.tsx` (bajo `apps/mobile/src`); `supabase/functions/reverse-location/index.ts`; `scripts/live-navigation.test.cjs`.

Modificados: `packages/contracts/src/maps.ts`; `supabase/functions/calculate-bike-route/index.ts`, `supabase/functions/_shared/domain.ts`, `supabase/config.toml`; `apps/mobile/src/modules/rides/components/RideLayout.tsx`, `apps/mobile/src/modules/maps/components/NativeCyclingMap.tsx`, `apps/mobile/src/modules/maps/types/map.types.ts`, `apps/mobile/src/app/route/[id].tsx`, `apps/mobile/src/shared/services/map-functions.ts`; `apps/mobile/package.json`, `pnpm-lock.yaml`, `package.json`, `scripts/ride-saving.test.cjs`.

## Validación y pendientes

TypeScript, suite automatizada, compatibilidad de dependencias SDK 57 y exportación Metro/Hermes para Android e iOS. Las pruebas cubren nombres y maniobras, avances, giros, huecos MultiLineString, cruces y bucles, ciclovías cercanas, voz opcional sin duplicados, GPS impreciso/caducado, desvíos sostenidos, recálculo desde la posición real y salidas libres sin giros inventados. La prueba de ampliación del mapa sigue verificando que no se desmonta al cambiar de vista.

Pendiente en dispositivo físico con el nuevo binario: calidad de voz española del sistema, cámara, permisos GPS, llegada y desvío reales. No se ha generado un APK ni probado un recorrido físico desde este entorno.
