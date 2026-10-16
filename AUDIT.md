# Auditoría técnica de cycling — 16 de octubre de 2026

Se inspeccionaron todos los archivos de aplicación, contratos, configuración Expo, workspace, lockfile, SQL, seed y función Edge. Se conservaron Expo SDK 57, la arquitectura y las dependencias. No se ejecutaron migraciones, seed ni escrituras remotas.

## Diagnóstico prioritario

| Prioridad | Hallazgo | Estado |
|---|---|---|
| P1 | La configuración Supabase se evaluaba al importar el cliente: variables ausentes o URL inválida podían impedir mostrar la aplicación. | Corregido: cliente diferido y pantalla de configuración; rechazo de claves secretas/service_role. |
| P1 | `getSession()` no manejaba rechazos ni errores del resultado; las pantallas se montaban antes de terminar la restauración. El listener AppState no se retiraba. | Corregido: carga inicial, error/reintento y limpieza del listener y renovación. |
| P1 | Historial en memoria sin limpiar al cerrar/cambiar sesión; respuestas tardías podían restaurar datos del usuario anterior. | Corregido: reinicio por identidad y descarte de respuestas tras perder foco/cambiar usuario. |
| P1 para APK propio | Falta configuración de Google Maps para una compilación propia Android. | Pendiente de clave restringida a paquete y certificado; Expo Go no requiere esta configuración. |
| P1 validación | No hay `adb.exe` ni `emulator.exe` en `ANDROID_HOME`; no se pudo lanzar un dispositivo ni obtener logcat. | Bundle Android generado; ejecución nativa pendiente. |
| P2 | La solicitud de permisos GPS estaba fuera del try/catch. El mapa solicitaba mostrar ubicación antes de iniciar GPS. | Corregido: errores capturados y ubicación del mapa activada tras iniciar tracking con permiso. |
| P2 | Expresiones `error && <View>` podían renderizar cadenas vacías en contenedores nativos. | Corregido en Explorar/Pedalear con condiciones booleanas. |
| P2 | README referencia `.env.example` inexistente e indica ejecutar SQL ya aplicado. | Añadido ejemplo; aclarado aprovisionamiento frente a proyecto existente. |
| P2 | Sesión persistida en AsyncStorage, sin cifrado en reposo; SecureStore instalado pero no utilizado. | Pendiente de adapter seguro con manejo del tamaño de sesión y migración de sesiones existentes. |
| P2 | Mapeadores geográficos aceptan números no finitos y coordenadas fuera de rango; los tipos de filas no validan el contrato remoto. | Pendiente de validación de datos antes de enviarlos a mapas y persistencia. |
| P2 | SQL acepta métricas de distancia/duración suministradas por cliente y no verifica completamente límites geográficos, fechas finales y consistencia temporal. | Pendiente de nueva migración revisada; no se cambió producción ni la migración aplicada. |
| P2 | GPS: sin pausa/reanudar, manejo de pérdida de señal ni cancelación completa de inicios concurrentes/desmontaje durante permisos. | Pendiente; no habilitar background. |
| P2 | Fallar el guardado deja el recorrido sin una acción explícita de reintento; iniciar otro GPS borra el estado anterior. | Pendiente antes de uso real de tracking. |
| P3 | Servicios se llaman desde pantallas en vez de hooks de dominio; filas Supabase usan `Record<string, any>`. | Pendiente de evolución gradual, sin refactor masivo. |
| P3 | Consultas limitadas a 100 rutas y 500 ciclovías, sin filtro espacial ni paginación. Historial limitado a 100. | Adecuado solo para volumen inicial; no calcular totales globales desde esta lista parcial. |
| P3 | No hay repositorio `.git` en este directorio ni suite previa de tests/lint. | No es posible entregar diff contra un commit ni atribuir cambios previos. |

No se encontraron errores de imports o TypeScript en la línea base. No se reprodujeron duplicados nativos, incompatibilidades SDK, advertencias offline ni fallos tunnel. No se atribuye la pantalla histórica “Something went wrong” a una causa concreta sin reproducción/logcat del dispositivo.

## Dependencias y Expo Router

- Instalado: Expo 57.0.30, React Native 0.86.3, React 19.2.3, Router 57.0.28, Maps 1.27.2, Reanimated 4.5.1 y Worklets 0.10.1.
- Las versiones pasan `expo install --check` y las 21 comprobaciones de Expo Doctor, incluida resolución de módulos nativos.
- Node instalado 22.16.0; pnpm global 9.15.4 frente al 10.15.0 declarado. `corepack pnpm --version` devuelve 10.15.0. Usar este último para instalaciones reproducibles.
- Workspace hoisted, paquete de contratos TypeScript, entrada `expo-router/entry`, `src/app` y Babel con preset Expo funcionan en el bundle Android. No se justifica añadir configuración Metro manual.
- No hay carpetas Android/iOS ni configuración EAS. `pnpm android` abre el servidor e intenta lanzar un cliente; no compila un APK.
- La falta de clave Maps es un pendiente para el binario propio; no prueba un fallo actual de Expo Go. [Documentación oficial de Maps SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

## Supabase y seguridad

Inspección estática de la migración existente:

- Tablas con RLS; rutas/ciclovías legibles y sin escritura pública.
- Historial con SELECT para authenticated y filtro `auth.uid() = user_id`.
- Vistas `security_invoker=true`, conservando permisos y RLS de las tablas.
- `save_ride` requiere autenticación, deriva propietario en servidor, tiene search_path vacío y EXECUTE revocado a PUBLIC/anon. La escritura SECURITY DEFINER exige mantener validaciones explícitas, pues opera con privilegios de su propietario.
- Índices GiST en geometrías de rutas/ciclovías; índice por usuario en recorridos. Este último ordena por created_at, mientras el cliente ordena por started_at: revisar con EXPLAIN al crecer el historial.
- `health` solo devuelve un estado público y no usa credenciales ni operaciones privilegiadas.
- La migración no es completamente repetible: CREATE POLICY sin guardas falla al repetirla. No volver a aplicarla manualmente.

Consultas remotas realizadas únicamente con la clave pública configurada:

| Consulta | Resultado |
|---|---|
| GET `/auth/v1/settings` | HTTP 200; email habilitado y confirmación requerida. |
| SELECT id de `routes_public`, limit 1 | HTTP 200, una fila. |
| SELECT id de `bike_lanes_public`, limit 1 | HTTP 200, una fila. |
| SELECT id de `rides_private` sin sesión | HTTP 401, acceso denegado. |

Estas pruebas no acreditan las políticas reales entre dos usuarios autenticados ni el éxito de registro/login/refresh/guardado: no se crearon usuarios ni recorridos. No se dispone de acceso administrativo al catálogo remoto para cotejar las políticas desplegadas. Las variables locales no se copiaron al informe.

## Cambios de archivos

- `apps/mobile/src/shared/config/env.ts`: validación de URL y tipo de clave; error legible sin lanzar al importar.
- `apps/mobile/src/shared/supabase/client.ts`: cliente singleton diferido; listener de ciclo de vida trasladado al provider.
- `apps/mobile/src/modules/auth/context/AuthContext.tsx`: restauración, estados de carga/error y limpieza.
- `apps/mobile/src/modules/auth/services/auth.service.ts`, `modules/routes/services/routes.service.ts`, `modules/bike-lanes/services/bike-lanes.service.ts`, `modules/rides/services/rides.service.ts`: uso del cliente diferido.
- `apps/mobile/src/app/_layout.tsx`: pantalla de configuración inválida.
- `apps/mobile/src/app/(tabs)/activity.tsx`: aislamiento del historial en memoria.
- `apps/mobile/src/app/(tabs)/ride.tsx`, `explore.tsx`: condiciones booleanas y permiso antes de mostrar ubicación.
- `apps/mobile/src/modules/rides/hooks/useRideTracker.ts`: captura de errores de permisos y guardia de watcher ya activo.
- `apps/mobile/.env.example`, `scripts/check-env.test.cjs`, `README.md`, `AUDIT.md`: configuración de ejemplo, regresiones y documentación.

## Validación reproducible

Desde la raíz:

```powershell
corepack pnpm --version
corepack pnpm install --lockfile-only --frozen-lockfile --ignore-scripts
corepack pnpm check
corepack pnpm --filter @cycling/contracts check
node --test scripts/check-env.test.cjs
corepack pnpm --filter @cycling/mobile exec expo install --check
```

Desde `apps/mobile`:

```powershell
corepack pnpm dlx expo-doctor
corepack pnpm exec expo export --platform android --output-dir .expo/audit-android
```

La validación lockfile-only comprueba consistencia de manifests/lockfile; no acredita una instalación limpia de dependencias. El bundle generado es bytecode Hermes con assets, no APK ni prueba de ejecución de módulos nativos.

Resultados: TypeScript de mobile y contracts aprobado; cuatro pruebas de configuración aprobadas; dependencias Expo al día; Expo Doctor 21/21 aprobado; exportación Android aprobada. No se ejecutó compilación Gradle ni prueba en dispositivo.

## Criterio pendiente para declarar Android estable

1. Ejecutar Expo Go compatible SDK 57 en teléfono/emulador y conectar al servidor LAN. Capturar mensaje y logcat si vuelve a fallar; verificar que el QR apunte al servidor correcto. Probar tunnel solo si el fallo es de transporte.
2. Comprobar inicio, navegación, permiso concedido/denegado, GPS desactivado, login, confirmación de correo, cierre/reapertura y cambio entre dos cuentas sin filtrar historial.
3. Para development build/APK: configurar Maps con clave restringida y certificado, preparar build y comprobar mapas en el binario instalado.
4. Verificar RLS autenticado entre dos usuarios y persistencia segura; corregir pendientes de tracking antes de guardar actividades reales.

Se mantuvo el alcance de estabilización. Recuperación de contraseña, estadísticas, búsqueda, detalle de actividades y navegación avanzada siguen fuera de esta intervención.
