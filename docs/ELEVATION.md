# Elevación y desnivel por alternativa

## Auditoría

Antes de este cambio, `calculate-bike-route` solicitaba
`details=instruction_details,route_details`. No pedía `elevation`.
`normalizeRoute` conservaba distancia, tiempo, geometría 2D e instrucciones, pero
no interpretaba altitudes, y `PlannedRoute` no tenía campos de elevación. Los
valores desconocidos mostrados por la interfaz no eran un problema de formato:
faltaba el flujo de obtención y cálculo. No se disponía de una respuesta de
producción autenticada con elevación para contrastar; el contrato de Geoapify se
verificó contra su documentación oficial.

## Fuentes y contrato

- Geoapify: la misma petición de ruta agrega `details=elevation`. Se interpreta
  `properties.legs[].elevation_range` como pares `[distancia, altitud]` en metros.
  Alternativamente se aceptan `legs[].elevation` alineadas con los vértices de la
  geometría de cada tramo. Los offsets de distancia se acumulan entre tramos.
  `steps[].elevation_gain` no es el ascenso acumulado: no se utiliza como D+.
- MapTiler: las alternativas OSM consultan las altitudes de puntos interpolados
  sobre **su propia geometría**, sin solicitar otra ruta. También se utiliza como
  respaldo cuando Geoapify no entrega un perfil completo. La respuesta debe
  corresponder en orden y coordenadas a los puntos solicitados.
- La clave existente de MapTiler se comprobó con una petición real y se configuró
  como `MAPTILER_ELEVATION_KEY` en Supabase. No se agrega al cliente ni se imprime.
  El secreto `GEOAPIFY_API_KEY` sigue utilizándose únicamente en Edge.

Cada ruta incorpora `elevationGainMeters`, `elevationLossMeters`,
`minElevationMeters`, `maxElevationMeters`, `elevationProfile`, `elevationSource`,
`elevationStatus`, `elevationMethod` y espaciado objetivo. Los puntos del perfil
incluyen distancia, altitud nullable e índice de tramo. El contrato móvil usa
campos opcionales para admitir actividades y clientes anteriores.

## Método `dem-v1-50m-100-median3-deadband2`

1. Muestreo aproximadamente uniforme, objetivo de 50 m y máximo de 100 puntos,
   incluyendo extremos de cada tramo. En rutas largas aumenta el espaciado para
   mantener el límite. La interpolación se realiza sobre cada segmento real, no
   sobre una recta de origen a destino. Geoapify se remuestrea desde su perfil.
2. Mediana móvil de tres alturas para eliminar picos aislados. No se filtra entre
   tramos distintos ni a través de altitudes desconocidas; se conservan extremos.
3. Acumulación con ancla vertical: se acepta un nuevo cambio cuando difiere al
   menos 2 m de la última altura aceptada. Los incrementos positivos se suman a D+;
   los negativos en valor absoluto a D−. Las pendientes pequeñas sostenidas sí
   acumulan; no se descarta cada delta pequeño por separado. La oscilación residual
   final menor de 2 m no se cuenta. No es una suma de la diferencia de los extremos.
4. Mínimo y máximo se obtienen de las alturas filtradas válidas. Alturas negativas
   son válidas. Un perfil plano completo produce D+=0 y D−=0 conocidos.
5. Si falta una altura, queda un hueco en el gráfico y D+/D− completos son `null`.
   El estado es `partial`; mínimo/máximo representan solo las muestras conocidas.
   Si no hay información válida, estado `error` y valores desconocidos, nunca cero.

Límites adicionales: hasta 100 km y 20 tramos. El método no representa relieve más
pequeño que el muestreo y puede suavizar cimas estrechas. La elevación procede de
un modelo de terreno, no de mediciones GPS/barométricas; puede diferir de puentes,
túneles y estructuras. Cualquier cambio del método exige cambiar su versión.

## Caché, consumo y fallos

Se reutiliza `osm_cycleway_cache`, privada para el servidor, con clave SHA-256 de
geometría exacta, fuente y versión del método. Se almacenan únicamente campos de
elevación, sin claves API ni IDs de usuario. TTL: siete días para perfiles completos,
cinco minutos para resultados fallidos/parciales. No se agregan tablas, migraciones
ni políticas RLS. Las geometrías equivalentes agrupadas por el selector usan su
único trazado representativo; no se asigna el perfil de una ruta distinta.

Un mapa de promesas evita duplicados dentro de una instancia Edge; una inserción
única en la tabla privada actúa como lease de 120 s entre instancias. Si otro
proceso ya trabaja en el trazado se informa indisponibilidad temporal y no se
duplica el consumo. Las consultas fallan sin solicitar al proveedor si la caché
no está disponible. Los perfiles Geoapify ya recibidos siguen siendo utilizables.

MapTiler acepta hasta 50 posiciones por HTTP: cada ruta usa como máximo dos lotes.
Cada lote consume también un cupo `route` del control atómico existente, con el
usuario autenticado. Una búsqueda habitual puede consumir dos cupos de las fases
de ruta y hasta cuatro adicionales para elevar dos alternativas OSM. Con respaldo
MapTiler para las tres rutas, hasta ocho cupos. No se ampliaron las cuotas.
Esto limita llamadas, pero no reemplaza el control mensual del plan del proveedor.

Los fallos de elevación mantienen la geometría y la posibilidad de iniciar la
ruta. La Ruta Rápida aparece primero; las opciones OSM se completan junto con su
elevación. Si falta el perfil Geoapify, la rápida muestra elevación pendiente hasta
completar el respaldo. Cambiar tarjeta y abrir/cerrar panel o perfil no hace
consultas. La cámara conserva la misma referencia de geometría cuando solo cambia
el enriquecimiento. Se admite el corredor Geoapify de un `MultiLineString` de un
solo tramo, sin conectar tramos separados.

## Interfaz y persistencia

Las tarjetas mantienen el formato compacto: tiempo, distancia, D+ y cobertura.
Los detalles incluyen D− y errores discretos. Desde el resumen, «Ver perfil de
elevación» abre un gráfico nativo que permite tocar/deslizar para consultar altitud.
Admite accesibilidad ajustable con acciones para recorrer muestras y dibuja huecos
sin unirlos. No usa WebView, SVG nuevo ni una imagen del mapa.

El flujo de navegación recibe la ruta seleccionada con sus campos de elevación.
El JSON existente de la ruta prevista los conserva al guardar una actividad, sin
SQL nuevo. En el detalle se identifica expresamente como elevación de la **ruta
prevista completa**, no del tramo GPS realmente realizado. Actividades antiguas
sin perfil muestran ausencia de datos; no se consultan retroactivamente al abrirlas.

## Costos verificados el 19/10/2026

- Geoapify: para dos puntos y menos de 500 km, `elevation` agrega **1 crédito** a
  la petición existente. Con `route_details`, el total documentado es 3 créditos,
  frente a 2 anteriormente. Distancias mayores tienen multiplicadores adicionales.
  La caché de perfil no elimina este crédito si se solicita nuevamente una ruta
  al proveedor. No se conoce el plan contratado para convertir créditos a USD.
- MapTiler: **cada coordenada cuenta**, incluso dentro de un lote. Hasta 100
  unidades por trazado sin caché, hasta 200 para dos alternativas OSM. La tarifa
  pública de excedente Flex es USD 0.15/1000 unidades: hasta **USD 0.015 por ruta**,
  **USD 0.03 por dos**, o **USD 0.045** si las tres requieren MapTiler. Son estimaciones
  de excedente, excluyen impuestos y cuota/base del plan; dentro del cupo incluido
  no hay ese cargo marginal. Abrir paneles y cambiar selección no consume unidades.

Fuentes oficiales:

- [Geoapify Routing: contrato y créditos](https://apidocs.geoapify.com/docs/routing/)
- [MapTiler Elevation: formato, límites y cuota por coordenada](https://docs.maptiler.com/cloud/api/elevation/)
- [MapTiler: cómputo de lotes](https://docs.maptiler.com/guides/account/sessions-vs-requests/)
- [MapTiler: precios vigentes](https://www.maptiler.com/cloud/pricing/)

## Archivos de esta entrega

- Nuevos: `_shared/elevation.ts`, `_shared/elevation-service.ts`,
  `ElevationProfile.tsx`, `scripts/elevation.test.cjs` y este documento.
- Backend: `_shared/domain.ts`, `_shared/route-options.ts`,
  `calculate-bike-route/index.ts`.
- Cliente/contratos: `packages/contracts/src/maps.ts`, `useRoutePlanner.ts`,
  `RouteAlternativesSelector.tsx`, `ActivityDetail.tsx`.
- Validación: script raíz `test`, fixtures en `map-services.test.cjs`,
  `live-navigation.test.cjs`, `smart-routing.test.cjs`, `route-selector.test.cjs`.
- Documentación: `ROUTE_SELECTOR.md` y `SMART_ROUTES.md` enlazan este flujo.

## Validación y compilación

Resultado: TypeScript correcto, 155/155 pruebas aprobadas y Deno check de las
cuatro funciones geográficas correcto. Exportación Android/Hermes completada
(1955 módulos, 104 assets). `calculate-bike-route` desplegada en versión 7,
estado `ACTIVE`; secretos Geoapify y MapTiler presentes, contenido no mostrado.
Una petición sin sesión sigue devolviendo HTTP 401. No se ejecutaron migraciones.

Pruebas: rutas planas, subidas/bajadas, valores negativos, huecos, picos/ruido,
pendiente gradual, multitramos, respuestas Geoapify, geometrías independientes,
caché/concurrencia, cuotas, errores, selección de las tres rutas, actualización
tardía sin reiniciar cámara, perfil accesible y persistencia del JSON.

Prueba real MapTiler en Lima: HTTP 200, seis muestras válidas procesadas por el
método, D+=2 m y D−=3.5 m. Es una comprobación puntual del proveedor; no una
validación de precisión topográfica. Queda pendiente la prueba visual y GPS en
teléfono y contrastar una búsqueda Geoapify autenticada de extremo a extremo.

Este cambio no instala módulos nativos. Cycling Dev compatible puede cargarlo
desde Metro con `corepack pnpm start --clear` en `apps/mobile`. Preview necesita
otra APK para incluir el JavaScript: `corepack pnpm dlx eas-cli build --platform
android --profile preview`. No se inició un build EAS.
