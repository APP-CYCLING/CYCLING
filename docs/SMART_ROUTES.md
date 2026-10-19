# Rutas inteligentes: auditoría y plan

Actualización de elevación: consultar `ELEVATION.md` para perfiles independientes
por geometría, fuentes Geoapify/MapTiler, filtrado y costos. Las estimaciones de
tiempo del grafo conservan su modelo anterior: la elevación no cambia los costos
de enrutamiento ni se utiliza todavía para ajustar la duración por pendiente.

La referencia visual es la imagen adjunta en la conversación (avenida gris,
ciclovía verde independiente, centro amarillo y ruta azul). No se utiliza
`design/references/ciclovia-referencia.png`.

## Auditoría inicial

- `calculate-bike-route` llama Geoapify con `mode=bicycle` y normaliza una ruta.
- `get-bike-lanes` consulta Overpass desde Edge, con cuota autenticada y caché
  `osm_cycleway_cache`. El móvil consulta por viewport y cancela solicitudes obsoletas.
- `NativeCyclingMap` usa fuentes y capas MapLibre nativas; la infraestructura y
  la navegación ya son fuentes independientes. Falta distinguir lados y geometrías.
- `cycling_routes` almacena rutas de catálogo, no una red topológica OSM.
- `bike_lanes` almacena líneas con nombre/kind, sin IDs OSM ni nodos; ambos tienen
  índices GiST y RLS de lectura pública. No deben convertirse silenciosamente en
  un grafo ni mezclarse los registros demo con datos de enrutamiento.
- `osm_cycleway_cache` permite objetos JSON versionados privados al servidor.
  Se reutilizará con claves independientes para red topológica y visualización.
- La auditoría de tablas se basa en las migraciones del repositorio, no en una
  inspección del esquema remoto. No se ejecutarán migraciones.

## Plan de implementación

1. Ampliar clasificación OSM, metadatos y consulta de infraestructura existente.
2. Implementar grafo dirigido OSM acotado, solo conexiones por ID de nodo, costos
   configurables y restricciones de giro. Rechazar casos no soportados.
3. Mantener Geoapify para rápida; calcular prioridad y equilibrada sobre ese grafo.
   No conectar vías paralelas por cercanía ni interpolar calles inexistentes.
4. Selector de alternativas reales, estado de indisponibilidad y deduplicación.
5. Capas de infraestructura con simbología lateral explícita y ruta azul.
6. Pruebas de topología, sentidos, cobertura, duplicados y límites; validación SDK.

Geoapify documenta perfiles, `type=balanced|short` y opciones de evitar elementos,
pero no expone costos de segmentos por ciclovía en su contrato público. Por ello
no se usa el mismo resultado con tres etiquetas. La modalidad rápida sigue siendo
la propuesta eficiente del proveedor; no se afirma un óptimo global garantizado.

Referencias: https://apidocs.geoapify.com/docs/routing/ y
https://wiki.openstreetmap.org/wiki/Key:cycleway

## Arquitectura implementada

La interfaz actual usa un cálculo progresivo y selecciona **Ruta Rápida** por
defecto, sin esperar ni seleccionar automáticamente la recomendación equilibrada.
El contrato completo anterior sigue disponible. Ver `ROUTE_SELECTOR.md` para las
dos fases, caché privada, estados por modalidad y pruebas del selector compacto.

`calculate-bike-route` conserva su respuesta de ruta única para clientes anteriores.
Con `alternatives: true` agrega hasta tres opciones distintas y sus estados de
indisponibilidad. La misma petición incluye origen y destino; no se hacen tres
llamadas idénticas a Geoapify. Geoapify se consulta una vez y las otras estrategias
se resuelven con Dijkstra sobre la red dirigida OSM del corredor.

Los enlaces se forman por IDs de nodo OSM. No se conectan intersecciones dibujadas
sin un nodo común ni calzadas/ciclovías paralelas por proximidad. El origen/destino
del proveedor se vincula solo a una geometría única a menos de 1 m; una coincidencia
ambigua se rechaza. Los puntos interiores dividen el arco en su sentido permitido.
Las posiciones de un mismo nodo deben coincidir; de lo contrario se rechaza la red.

Se respetan `oneway`, `oneway:bicycle`, excepciones de contraflujo, restricciones
`bicycle:forward/backward` y giros simples mediante nodo `via`. Se excluyen acceso
privado/prohibido/restringido, barreras no autorizadas, autopistas, escaleras y
casos condicionales no soportados. Restricciones mediante vías `via` o múltiples
miembros excluyen conservadoramente las vías afectadas. No equivale a un motor
completo de reglas legales locales ni a una certificación de seguridad.

## Costos y límites

Todo está centralizado en `ROUTING_POLICY` de `_shared/cycling-graph.ts`:

| Estrategia | Peso tiempo | Peso distancia | Segregada | Carril | Compartida | Sin confirmar | Cambio de tipo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Prioridad ciclovías | 0.4 | 0.06 | 0.25 | 0.8 | 1.6 | 1.8 | 8 |
| Equilibrada | 1 | 0.04 | 0.75 | 0.9 | 1.3 | 1.65 | 3 |

Costo de arco: `(segundos × peso_tiempo + metros × peso_distancia) × factor_tipo`,
más penalización de transición. La prioridad valora especialmente infraestructura
segregada; no garantiza el máximo porcentaje bruto si una opción con carriles
pintados tiene menos conectores pero carece de separación física.

Los tiempos de las opciones OSM son **estimaciones de un modelo explícito**, con
velocidades base de 18/17/16/14 km/h por tipo. No son tiempos observados ni una
respuesta de Geoapify y se identifican así en las tarjetas. No incluyen pendiente,
tráfico, cruces o semáforos. Las distancias se miden con Haversine sobre cada arco.

Máximo desvío respecto a la distancia Geoapify: 1.6 en prioridad y 1.3 en equilibrada.
También se rechazan tiempos superiores al doble del proveedor (con suelo de 120 s
para trayectos muy cortos). El corredor tiene margen de 0.006 grados, máximo 0.12
grados por eje y 0.0048 grados cuadrados. Límites adicionales: 6000 vías, 60000
arcos, 100000 estados. El rendimiento real depende de la densidad de cada zona.

No se promete una solución global óptima ni tres resultados en todos los viajes.
Si el camino de menor costo viola el límite de desvío, se indica indisponibilidad;
no se implementa aquí una búsqueda multiobjetivo exhaustiva con recursos acotados.

## Cobertura y clasificación

- A: `highway=cycleway` y senderos designados con segregación explícita; `track`
  en una calzada indica infraestructura lateral y se marca como estimación.
- B: carril ciclista; los casos `advisory` son compartidos. Una dirección lateral
  no suficientemente documentada no se cuenta como carril exclusivo en el grafo.
- C: compartida o permiso `bicycle=yes`; no suma como ciclovía exclusiva.
- D: designación sin separación confirmada, etiquetas incompletas o ambiguas.

La cobertura de las opciones OSM suma longitudes de los arcos recorridos de A/B
y divide por la longitud total. Los IDs OSM se deduplican antes de construir la
red; no se usan buffers de proximidad para asignar porcentajes. Los porcentajes
describen infraestructura **registrada**, no verifican su existencia o buen estado
en campo. Datos basados en atributos se etiquetan como estimación.

Geoapify no proporciona en el contrato usado una correspondencia verificable de
todos los tramos con IDs OSM. Por ello su porcentaje es `null`/«no disponible»;
no se convierte una ciclovía cercana en evidencia de uso ni se muestra un falso 0 %.
La recomendación solo aparece cuando hay opciones OSM distintas y comparables.

## Visualización y rendimiento

MapTiler sigue proporcionando el mapa base. Una transformación local neutraliza
el color de las líneas `transportation` a gris, conservando fuentes, anchuras,
bordes, nombres y flechas. Infraestructura y navegación son fuentes independientes.
La ruta elegida es azul con borde blanco; las demás están atenuadas.

Los datos independientes conservan sus coordenadas. Los atributos con lado explícito
utilizan `line-offset` relativo a la dirección original de la vía, interpolado por
zoom. No se modifica la geometría ni se afirma una separación geográfica medida.
Sin lado conocido se dibuja una línea estrecha, sin la franja/centro amarillo que
simularía una ubicación física concreta. La línea amarilla es simbología del mapa,
no una afirmación de que exista pintura amarilla en la vía real.

Los símbolos proceden del glifo `bicycle-outline` de Ionicons ya incluido en el
proyecto, rasterizado a PNG transparente de 64 px; no es una foto ni un nuevo logo.
Se colocan mediante una capa de símbolos con espaciado, rotación, colisiones y zoom
mínimo 16. Las líneas se insertan bajo las etiquetas del mapa; los iconos sobre
la ruta. GeoJSON usa simplificación Douglas-Peucker nativa (`tolerance=0.375`) y
teselas hasta zoom 19. No se crean marcadores React por cada bicicleta.

El interruptor «Mostrar ciclovías» solo controla la visualización. El selector
conserva la opción elegida hasta cambiar origen/destino o recalcular; iniciar
Pedalear utiliza esa geometría. Un recálculo de navegación conserva la modalidad,
y si falla no la sustituye silenciosamente por otra.

## Datos, SQL y despliegue

No se crearon ni ejecutaron migraciones SQL. Se reutilizan los índices y RLS
existentes. Las claves privadas de proveedores continúan exclusivamente en Edge.
`osm_cycleway_cache` guarda datos versionados con claves `lanes-v2:` y
`routing-network-v1:`, fuente, área y fecha de actualización. La caché dura una hora;
el móvil conserva la caché visual breve existente. Se agrupan solicitudes idénticas
en vuelo dentro de cada instancia Edge. La cuota OSM existente se consume antes de
una descarga de red nueva, usando el ID autenticado del servidor, no uno del cliente.

Archivos nuevos:

- `supabase/functions/_shared/cycling-graph.ts`
- `supabase/functions/_shared/route-options.ts`
- `supabase/functions/_shared/corridor-network.ts`
- `apps/mobile/src/modules/route-planner/components/RouteAlternativesSelector.tsx`
- `apps/mobile/src/modules/maps/components/CycleInfrastructureLayers.tsx`
- `apps/mobile/src/modules/maps/utils/road-presentation.ts`
- `apps/mobile/assets/images/cycleway-bicycle.png`
- `scripts/smart-routing.test.cjs`

Archivos modificados:

- Edge: `calculate-bike-route/index.ts`, `get-bike-lanes/index.ts`, `_shared/domain.ts`, `_shared/http.ts`.
- Contratos: `packages/contracts/src/maps.ts`.
- Mapa: `NativeCyclingMap.tsx`, `PlannerLayout.tsx`, `map.types.ts`, `map-style.service.ts`.
- Planificación: `useRoutePlanner.ts`, `planner.service.ts`.
- Navegación: `useLiveNavigation.ts` y el timeout de `map-functions.ts` para alternativas.
- Validación: `package.json`, `scripts/location.test.cjs`, `scripts/map-services.test.cjs`.

Comandos desde la raíz:

```powershell
corepack pnpm check
corepack pnpm test
corepack pnpm dlx deno check --no-config supabase/functions/calculate-bike-route/index.ts supabase/functions/get-bike-lanes/index.ts
corepack pnpm dlx supabase functions deploy calculate-bike-route --project-ref puqbvxrpneujgvzrioqn
corepack pnpm dlx supabase functions deploy get-bike-lanes --project-ref puqbvxrpneujgvzrioqn
```

Para probar en el teléfono y generar APK, desde `apps/mobile`:

```powershell
corepack pnpm start
corepack pnpm dlx eas-cli build --platform android --profile development
corepack pnpm dlx eas-cli build --platform android --profile preview
```

## Pendientes de escala y comprobación física

Se debe comprobar el render nativo en Android/iOS, la colocación de símbolos y
offsets en avenidas reales, y varios viajes con GPS. Las pruebas sintéticas no
certifican la calidad de OSM en Lima ni el estado físico de la infraestructura.
Las consultas directas de QA a Overpass desde este entorno fallaron (HTTP 406 y
timeout); no se presenta como validada una descarga de red real de Avenida Larco.

Para recorridos de toda la ciudad y reglas avanzadas, la siguiente etapa sería
importar una red OSM completa y versionada a un servicio propio como Valhalla o
GraphHopper con costos personalizados y map matching por ID de vía. Se mantendría
el contrato de alternativas del móvil y Geoapify como proveedor rápido/fallback.
Eso requiere infraestructura operativa y pruebas de reglas, sin incorporar ahora
un proveedor de pago ni crear tablas de producción silenciosamente.

## Validaciones y estado del despliegue

- TypeScript móvil: correcto.
- Suite completa: 121 pruebas, todas correctas; 21 nuevas cubren el motor y la UI
  de rutas inteligentes, más las pruebas existentes adaptadas al contrato nuevo.
- Deno: las cuatro Edge Functions pasan la comprobación de tipos.
- Las capas nuevas pasan `validateStyleMin` de la especificación MapLibre instalada.
- Exportación Android Metro/Hermes: correcta, 1954 módulos y 104 assets, incluyendo
  el icono de bicicleta. No se generó una APK ni se realizó una prueba física.
- `calculate-bike-route` versión 4 y `get-bike-lanes` versión 3 desplegadas y ACTIVE
  en el proyecto vinculado. Ambas rechazan solicitudes sin sesión con HTTP 401.
- La respuesta autenticada completa con datos OSM de Lima sigue pendiente de prueba
  en la app. El estado ACTIVE y el HTTP 401 no verifican ese recorrido de extremo a extremo.
