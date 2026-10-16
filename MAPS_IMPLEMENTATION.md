# Mapas y planificación ciclista

## Estado comprobado — 16 de octubre de 2026

Se implementó el flujo móvil y se desplegaron estas funciones en Supabase Cloud:

| Función | Estado remoto | Pruebas HTTP reales |
|---|---|---|
| calculate-bike-route | ACTIVE | OPTIONS 204, GET 405, POST sin sesión 401, JWT inválido 401 |
| search-destinations | ACTIVE | OPTIONS 204, GET 405, POST sin sesión 401, JWT inválido 401 |
| get-bike-lanes | ACTIVE | OPTIONS 204, GET 405, POST sin sesión 401, JWT inválido 401 |

`GEOAPIFY_API_KEY` está presente en los secretos del proyecto. No se leyó ni imprimió su contenido. El estilo MapTiler `streets-v4` respondió HTTP 200 con estilo versión 8, dos fuentes y 164 capas usando la clave pública local.

**Bloqueo pendiente:** una consulta de solo lectura confirmó que no existen `public.consume_map_quota(text,uuid)` ni `public.osm_cycleway_cache`. La migración aditiva `supabase/migrations/202610160002_map_services.sql` está preparada, pero **no se ejecutó**, por instrucción del usuario. No se ejecutaron otras migraciones ni seed, ni se modificaron rutas o recorridos existentes.

Las funciones validan la sesión y después exigen el control de cuotas. Hasta disponer de esas estructuras, una solicitud autenticada encuentra un error controlado HTTP 503 antes de consumir Geoapify/Overpass. Esto está comprobado mediante pruebas automatizadas con dependencias simuladas y la ausencia real del esquema; no se hizo una llamada remota autenticada. No se considera validado el cálculo real de rutas ni la búsqueda real de Geoapify todavía.

## Uso móvil implementado

1. Abrir Explorar en una compilación propia de cycling.
2. Pulsar «Usar mi ubicación» para autorizar GPS. Si se deniega o no hay una posición fiable, explorar el mapa mundial y elegir el origen manualmente. No se asigna ninguna ciudad como posición del usuario.
3. El origen A se fija al primer punto GPS válido o a un toque manual. «Cambiar origen» invalida la ruta y permite elegir otro punto.
4. Tocar un destino B o buscar una dirección/lugar. Las sugerencias usan debounce de 550 ms, sesgo de proximidad y descarte de respuestas obsoletas. Limpiar el campo elimina el destino y la ruta.
5. Confirmar «Calcular ruta para bicicleta». La cámara se ajusta al trazado. Mover el mapa o recibir un fix GPS no recalcula rutas.
6. Usar los controles para centrar ubicación, alternar infraestructura, cambiar destino y ajustar la cámara a la ruta.
7. Tocar infraestructura para ver su nombre, clasificación, superficie y separación si están disponibles. Mantener pulsado permite elegir un punto incluso sobre un tramo.
8. «Comenzar recorrido» abre Pedalear, conserva el trazado como referencia e inicia el GPS. No ofrece instrucciones giro a giro ni rerouting automático. El registro se detiene al dejar la pantalla o pasar a segundo plano; al volver puede guardarse lo registrado.

El mapa base y la selección manual funcionan sin sesión. Los servicios que consumen recursos requieren Supabase Auth. El catálogo de Inicio excluye las filas `is_demo=true`; el mapa tampoco dibuja geometrías demo.

## Implementación y datos

- MapLibre React Native **11.5.0**, fijado en package.json y lockfile. Sus peers declaran Expo >=54, React Native >=0.80 y React >=19.1, compatibles por versiones declaradas con Expo 57 / RN 0.86.3 / React 19.2.3. Se comprobaron TypeScript y prebuild; esto no sustituye una prueba del binario Android.
- Plugin `@maplibre/maplibre-react-native`, development client Expo 57 y `expo-system-ui` para respetar el modo claro. Se retiró react-native-maps.
- API nativa v11 (`Map`, `Camera`, `GeoJSONSource`, `Layer`, `Marker`), `androidView="texture"`, base MapTiler Streets, estado de carga y reintento ante fallo/timeout. El componente nativo se carga solo fuera de Expo Go; web muestra una explicación.
- GPS de primer plano: permiso por acción del usuario, precisión máxima de 100 m para el mapa, fixes de hasta 30 s, timeout inicial de 15 s y aviso de señal perdida. La suscripción se retira al perder foco, pasar a segundo plano o desmontar, incluidas altas asíncronas tardías. El tracker mantiene su filtro de 70 m y ya cancela inicios obsoletos.
- El servicio de rutas pide `mode=bicycle` y `units=metric`. Los waypoints de la URL son latitud,longitud; GeoJSON conserva longitud,latitud. Se admiten LineString y MultiLineString. Se conservan todos los segmentos y no se crean líneas entre tramos desconectados.
- Distancia y duración proceden del proveedor; no se inventan valores de respaldo. Errores del proveedor, respuestas vacías y geometrías inválidas se muestran como fallos controlados.
- OSM/Overpass: consultas de ways por etiquetas específicas en una ventana máxima de 0.12° por eje, ampliada a una cuadrícula de 0.02°. No se consulta todo el mundo. Cambios de cámara se agrupan con debounce y al menos 11 s entre consultas iniciadas por pantalla.
- Caché móvil: 24 ventanas como máximo y TTL de cinco minutos. Caché compartida preparada en Supabase: una hora por ventana. El acceso a esa caché es exclusivamente del servidor.
- Verde sólido: highway=cycleway o pista track. Verde discontinuo: lane. Ocre: shared_lane, share_busway y bicycle=designated. Una calle con bicycle=yes o cycleway=no no se transforma en una ciclovía. cycleway con segregated=no se clasifica compartida. Los ejes OSM no representan necesariamente el borde físico de un carril y sus etiquetas no certifican seguridad.
- Atribución visible y enlazada a MapTiler y OpenStreetMap.

## Seguridad de las funciones

El móvil solo tiene las claves públicas de Supabase y MapTiler. Geoapify se obtiene de `Deno.env.get('GEOAPIFY_API_KEY')`; la clave administrativa de Supabase solo se utiliza dentro de Edge Functions.

`verify_jwt=false` está configurado porque cada handler verifica explícitamente el JWT del usuario mediante `supabase.auth.getUser(token)`, que consulta Supabase Auth y no depende de una clave JWT simétrica local. No significa que los endpoints sean públicos: rechazan tokens ausentes o inválidos antes de ejecutar la lógica geográfica. Verificado en los endpoints desplegados.

La migración pendiente prepara límites atómicos compartidos por usuario/minuto, usuario/día, global/minuto y global/día. La RPC solo admite EXECUTE del rol service_role; las tablas tienen RLS y no conceden acceso al cliente. Los errores del control de cuotas fallan cerrado.

| Acción | Usuario/min | Usuario/día | Global/min | Global/día |
|---|---:|---:|---:|---:|
| Ruta | 8 | 150 | 100 | 5000 |
| Búsqueda | 30 | 600 | 300 | 15000 |
| Ciclovías | 6 | 100 | 12 | 1000 |

Son techos de solicitudes, no una garantía de coste ni una medición de créditos de Geoapify. Se deben ajustar al plan contratado antes de producción. Se limitan tamaños de cuerpo entrante (4 KB) y respuesta de proveedor (8 MB), rango de coordenadas, área consultada y tiempo de descarga. No se aceptan URLs de proveedores suministradas por el usuario ni se devuelven errores que contengan claves.

## Variables de entorno

En `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=<URL pública del proyecto>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clave publishable o anon>
EXPO_PUBLIC_MAPTILER_KEY=<clave pública MapTiler>
```

En Supabase Secrets: `GEOAPIFY_API_KEY`. Nunca crear una variable `EXPO_PUBLIC_GEOAPIFY_API_KEY`. Las credenciales locales no se copiaron a la documentación.

En EAS deben configurarse las tres variables públicas en los entornos `development` y `preview` que se vayan a compilar, antes de construir el APK. La clave de Geoapify permanece exclusivamente en Supabase. Si MapTiler devuelve 403, revisar las restricciones de la clave para peticiones de la app nativa; no sustituir por un proveedor de respaldo.

## Compilación y ejecución

MapLibre no está incluido en Expo Go. Se prepararon `apps/mobile/eas.json` y el plugin nativo. **No se compiló ni instaló un APK en esta sesión.** La ruta ANDROID_HOME de este equipo no contiene adb/emulador; no se validó el mapa en un teléfono físico.

Desde la raíz, con Android Studio/SDK y dispositivo configurados:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm android
```

`android` ahora ejecuta `expo run:android`: genera/compila el binario propio. En macOS, `corepack pnpm ios` ejecuta `expo run:ios`.

Para EAS, desde `apps/mobile`, iniciar sesión y vincular el proyecto Expo/EAS si aún no lo está. El vínculo de Supabase no vincula una cuenta Expo:

```powershell
corepack pnpm dlx eas-cli login
corepack pnpm dlx eas-cli init
corepack pnpm dlx eas-cli build --profile development --platform android
```

Instalar el APK generado y después ejecutar `corepack pnpm dev` desde la raíz. El servidor usa `expo start --dev-client`. Para APK interno con bundle integrado, usar el perfil `preview`; no necesita Metro.

Este directorio inicialmente no tenía `.git`. Si se mantiene así, EAS permite `EAS_NO_VCS=1` y `EAS_PROJECT_ROOT` apuntando a la raíz del monorepo, para incluir también `packages/contracts`. No ejecutar EAS con una raíz limitada a apps/mobile que omita los contratos. No se creó un repositorio Git ni un proyecto EAS automáticamente.

## Despliegue de Supabase

Ya realizado, sin Docker y sin migraciones:

```powershell
corepack pnpm dlx supabase functions deploy calculate-bike-route search-destinations get-bike-lanes --use-api
corepack pnpm dlx supabase functions list
```

El proyecto vinculado es cycling. La configuración local del CLI está excluida de Git en `supabase/.temp/`. No usar `--prune`, reset ni db push para desplegar estas funciones. La activación de la migración de cuotas/caché está pendiente de autorización separada; no se vuelve a ejecutar la migración inicial.

## Validaciones

Resultados finales: TypeScript móvil y contratos aprobado; **14/14 pruebas** aprobadas; Deno check de las tres funciones aprobado; Expo Doctor **21/21** aprobado; dependencias Expo compatibles; lockfile consistente con pnpm 10.15.0; exportaciones Android y web aprobadas; prebuild Android aislado aprobado sin advertencias de modo claro. El escaneo de código y documentación no encontró claves `sb_secret_` ni JWT service_role incorporados; se excluyeron archivos de entorno y artefactos generados para no exponer credenciales locales.

```powershell
corepack pnpm check
corepack pnpm --filter @cycling/contracts check
node --test scripts/check-env.test.cjs scripts/map-services.test.cjs
corepack pnpm dlx deno check supabase/functions/calculate-bike-route/index.ts supabase/functions/search-destinations/index.ts supabase/functions/get-bike-lanes/index.ts
corepack pnpm --filter @cycling/mobile exec expo install --check
```

Desde apps/mobile:

```powershell
corepack pnpm dlx expo-doctor
corepack pnpm exec expo export --platform android --output-dir .expo/maps-android
```

Se generó un proyecto nativo de inspección en `.expo/native-maplibre-check` con `expo prebuild --platform android --no-install`, separado del código de la app. El manifiesto incluye INTERNET y permisos de ubicación de primer plano, sin ACCESS_BACKGROUND_LOCATION. Esta prueba verifica generación/configuración, no compilación Gradle.

## Archivos

- `apps/mobile/src/modules/maps/`: componentes nativos y web, pantalla de planificación, tipos y utilidades geográficas.
- `modules/geolocation/`: servicio y hook de ubicación.
- `modules/route-planner/`: servicios de búsqueda/routing y hooks con cancelación.
- `modules/bike-lanes/hooks/useVisibleBikeLanes.ts` y `services/osm-lanes.service.ts`: consulta de ventana y caché móvil.
- `modules/navigation/services/planned-ride.store.ts`: ruta confirmada en memoria, aislada por usuario, para iniciar registro.
- `modules/rides/screens/RideScreen.tsx`, `hooks/useRideTracker.ts`: pantalla modular de registro y limpieza GPS.
- `modules/routes/services/routes.service.ts`: excluir el catálogo demo.
- `src/app/(tabs)/explore.tsx`, `ride.tsx`: entradas delgadas de Router.
- `src/shared/services/map-functions.ts`, `hooks/useScreenFocused.ts`: llamadas autenticadas y coordinación de foco.
- `packages/contracts/src/maps.ts`, `src/index.ts`: contratos de coordenadas, rutas, destinos y capas.
- `supabase/functions/{calculate-bike-route,search-destinations,get-bike-lanes,_shared}/`: endpoints y lógica común.
- `supabase/config.toml`, `migrations/202610160002_map_services.sql`: despliegue y esquema aditivo pendiente.
- `apps/mobile/{app.json,package.json,eas.json,.env.example}`, `.npmrc`, `.gitignore`, `pnpm-lock.yaml`: dependencias, plugins, configuración y exclusiones.
- `scripts/map-services.test.cjs`: regresiones de geometría, etiquetas OSM, límites, autenticación y errores.
- `package.json`: comando de pruebas del workspace.

## Límites pendientes

- Activar el esquema de cuotas/caché con autorización, y probar solicitudes reales con un usuario autenticado. Verificar la presencia de un secreto no demuestra que la clave tenga saldo o permisos en Geoapify.
- Compilar e instalar el APK y comprobar permisos concedidos/denegados, carga de recursos, interacción táctil, cámara, GPS real y navegación entre pantallas. El renderizado Android no se da por validado por el bundle o el prebuild.
- Web es una pantalla informativa para el mapa; esta entrega es para la app nativa.
- Overpass público es una solución inicial acotada. Para producción, importar extractos regionales OSM a PostGIS, actualizar por procesos administrativos y consultar con índices espaciales. La caché actual es GeoJSON temporal, no un inventario geográfico regional. Los fallos/timeouts de Overpass no generan geometrías de respaldo.
- La cobertura/calidad de OSM y Geoapify puede variar. No hay navegación giro a giro, voz, rutas offline, alternativas ni garantías de segregación/seguridad.
- El cruce del antimeridiano no se admite en las ventanas de ciclovías. El GPS y el plan confirmado se mantienen en memoria; no hay recuperación tras cierre forzado ni tracking en segundo plano.

Documentación primaria consultada: [MapLibre con Expo](https://maplibre.org/maplibre-react-native/docs/setup/expo/), [MapLibre v11](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/), [MapTiler](https://docs.maptiler.com/maplibre/), [Geoapify Routing](https://apidocs.geoapify.com/docs/routing/), [Autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [Supabase Auth JWT](https://supabase.com/docs/guides/auth/jwts), [EAS monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/), [EAS sin VCS](https://github.com/expo/fyi/blob/main/eas-build-archive.md).
