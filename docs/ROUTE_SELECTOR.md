# Selector de rutas CYCLING

La ampliación de D+, D− y perfil por geometría está documentada en `ELEVATION.md`.
Las tarjetas incorporan D+ sin consultas adicionales al cambiar selección.

## Comportamiento

Al elegir destino y disponer de origen, se calcula automáticamente la Ruta Rápida
(`fast`, rayo amarillo). Su geometría aparece sin esperar la red OSM. Después se
completan Ruta Ciclista (`cycleway_priority`, bicicleta azul) y Ruta Equilibrada
(`balanced`, icono de ruta lima). Una recomendación tardía no cambia la selección.

El panel oscuro ocupa como máximo el 56 % de la altura disponible, tiene scroll
interno y respeta el inset inferior. Cada tarjeta presenta nombre, tiempo,
distancia y cobertura; la descripción ocupa una línea y los detalles se abren con
el icono de información. Una cobertura desconocida se muestra con «—», nunca 0 %.
Los porcentajes estimados llevan asterisco y su explicación está en los detalles.

Cerrar mantiene la ruta. «Cambiar ruta» reabre el selector sin llamadas al servidor.
«Iniciar ruta» entrega exactamente la geometría seleccionada al flujo de navegación
existente y cierra el panel. No cambia rutas ni inicia navegación por seleccionar
una tarjeta. El tema global sigue controlándose desde Configuración; el panel de
alternativas mantiene el fondo oscuro solicitado.

## Estado y archivos

- `useRoutePlanner.ts`: `selectedRouteMode`, alternativas, geometría activa,
  origen capturado, estados por modalidad (`loading`, `ready`, `unavailable`,
  `error`), apertura y errores. AbortController y generación descartan respuestas
  obsoletas; un guard evita cálculos simultáneos duplicados.
- `useMapPlanner.ts`: dispara una vez por destino, invalida al cambiar el origen
  manual y conserva el contrato de `setPlannedRide` y Expo Router.
- `RouteAlternativesSelector.tsx`: panel, tarjetas compactas y resumen reutilizable.
- `PlannerLayout.tsx`: acciones, resumen, modal y geometrías alternativas atenuadas.
- `NativeCyclingMap.tsx` y `map.types.ts`: padding adaptable para ajustar la cámara
  al área visible. La fuente GeoJSON cambia reactivamente; MapView no se remonta
  al cambiar tarjeta. Se conservan infraestructura, marcadores y atribuciones.
- `planner.service.ts` y `packages/contracts/src/maps.ts`: contrato progresivo.
- `calculate-bike-route/index.ts` y `_shared/route-calculation.ts`: reutilización
  autenticada del resultado del proveedor entre fases.
- `scripts/route-selector.test.cjs`: pruebas de estado, integración y servidor.
  Se ajustaron también los fixtures de `location.test.cjs` y `smart-routing.test.cjs`
  y se agregó la nueva suite al comando raíz `test`.

## Cálculo progresivo y límites

1. `phase: "fast"` consulta Geoapify una vez y devuelve ruta e identificador aleatorio.
2. `alternatives: true` con `calculationId` recupera esa ruta y reutiliza el motor
   OSM existente. No vuelve a consultar Geoapify.
3. Cambiar tarjeta o cerrar/reabrir no solicita cálculos.

El identificador corresponde a una entrada privada de `osm_cycleway_cache`, vinculada
al usuario autenticado y a las coordenadas exactas de origen/destino. Se acepta
durante cinco minutos; la limpieza física sigue el mecanismo existente de caché.
La entrada incluye coordenadas y ruta. No se agregan tablas, migraciones, políticas
RLS ni secretos en el cliente. Cada fase consume la cuota de solicitudes Edge
existente: dos solicitudes de ruta por búsqueda, una sola consulta a Geoapify.

Si falla la caché o el cálculo opcional, la Ruta Rápida sigue disponible. Si falla
la ruta base, el motor actual no puede calcular las otras opciones porque necesita
su corredor. Si una respuesta contiene opciones válidas sin `fast`, se selecciona
una disponible y se explica el cambio. Los límites de conectividad y cobertura OSM
siguen documentados en `SMART_ROUTES.md`; no se fabrican tres recorridos ni se
duplican geometrías equivalentes como alternativas independientes.

## Validación y prueba en teléfono

Validación automatizada: TypeScript, 134 pruebas y Deno check de la función de
rutas. Incluye fast antes de alternativas, cambios de geometría, cierre/reapertura,
inicio con la selección exacta, respuestas obsoletas, opciones no disponibles,
duplicados, aislamiento por usuario y una consulta Geoapify entre las dos fases.
El empaquetado Expo Android verifica el bundle, pero no sustituye una prueba física.

Resultado del 18/10/2026: 134/134 pruebas aprobadas, `tsc --noEmit` y Deno check
correctos, exportación Android completada (1954 módulos, 104 assets).
`calculate-bike-route` quedó desplegada en versión 5, estado `ACTIVE`; una petición
sin sesión devuelve HTTP 401. Esa comprobación no equivale a probar una búsqueda
autenticada con GPS en el teléfono. No se ejecutaron migraciones.

Desde `apps/mobile`, con Cycling Dev instalado y compatible con los módulos
nativos actuales:

```powershell
corepack pnpm start --clear
```

Elegir destino, comprobar Ruta Rápida, alternar las otras opciones disponibles,
cerrar/reabrir e iniciar. Verificar cámara, textos grandes, pantalla pequeña,
ubicación real y conservación de ciclovías. Probar también una zona sin alternativas.

Preview necesita una nueva APK para incorporar este JavaScript:

```powershell
corepack pnpm dlx eas-cli build --platform android --profile preview
```

Este cambio no agrega dependencias nativas. Si Cycling Dev aún no incluye los
módulos de grabación en segundo plano de cambios anteriores, recompilar primero
con `--profile development`. No se inició una compilación EAS como parte de esta
entrega.
