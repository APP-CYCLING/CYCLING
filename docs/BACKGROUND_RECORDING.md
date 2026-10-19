# Grabación de recorridos en segundo plano

La grabación dejó de depender del foco de Pedalear y del watcher del mapa.
`index.ts` registra una tarea global de `expo-task-manager` antes de Expo Router.
La tarea recibe actualizaciones de `expo-location`, tanto en primer plano como
con otra app abierta o con la pantalla bloqueada. El watcher de pantalla de Pedalear se
desactiva mientras se está grabando para evitar dos fuentes de puntos.

## Inicio y finalización

- Al iniciar una grabación, se comprueban ubicación precisa, servicios GPS y
  permisos de primer y segundo plano. Se explica el permiso antes de solicitarlo.
- Android utiliza un servicio de ubicación con notificación persistente de CYCLING.
  Tocar esa notificación abre la aplicación para finalizar y guardar.
- iOS configura el modo nativo `location`, permiso Siempre e indicador de ubicación.
- Cambiar de pestaña, bloquear la pantalla o desmontar el componente no detiene
  el servicio. Finalizar sí detiene el GPS antes de abrir el diálogo de guardado.
- Un cambio de cuenta detiene la grabación anterior y mantiene su borrador separado
  por usuario. La siguiente cuenta no ve sus puntos ni su destino.

## Persistencia y recuperación

`RecordingStore` serializa las escrituras de la interfaz y la tarea a AsyncStorage.
Cada lote recibido conserva puntos, kilómetros, fechas, último GPS y el plan
original (geometría, destino y origen). No necesita conectividad para registrar.
Los lotes se ordenan y deduplican por fecha de captura; no se descartan por haber
llegado más tarde que el límite de frescura de la interfaz.

Al abrir la app se recupera el borrador y se consulta si el servicio nativo sigue
registrado. Si continúa activo, la pantalla muestra su progreso. Si fue detenido,
el borrador aparece interrumpido con hora final en el último punto recibido;
no se inventan puntos ni se suma el tiempo posterior al cierre. Se puede guardar
lo recuperado. La restauración no vuelve a encender el GPS silenciosamente.

Al guardar, se conserva también el ID devuelto por Supabase en el borrador hasta
completar la subida de fotos y eliminarlo. Esto evita repetir la creación del
recorrido si se reinicia la app después de guardar la actividad y antes de terminar
las fotos. No ofrece atomicidad entre la respuesta del servidor y el almacenamiento
local si el proceso muere exactamente entre esas dos operaciones. La selección de
fotos aún pertenece al diálogo de la sesión y debe repetirse tras un cierre.

## Límites del sistema operativo

Segundo plano y bloqueo de pantalla están contemplados. Un cierre forzado desde
Ajustes, detener la app en el administrador de tareas, reiniciar el teléfono o las
restricciones de batería del fabricante pueden detener el proceso y el GPS. Quitar
la app de recientes depende del dispositivo. Android usa `killServiceOnDestroy:
false`, pero no se promete supervivencia al cierre forzado. Se conserva lo recibido
hasta entonces. La guía por voz, consultas de calles y cámara siguen ligadas a la
pantalla de navegación; este cambio mantiene el registro GPS, no añade audio en
segundo plano.

## Validación

- TypeScript y las 95 pruebas del repositorio pasan, incluyendo 13 nuevas de
  persistencia, lotes diferidos, recreación del proceso, interrupción, permisos,
  aislamiento por cuenta, finalización, filtros GPS y reintentos de guardado.
- La introspección de Expo en development y preview confirma los permisos Android
  `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
  y `UIBackgroundModes: location` con el permiso Siempre en iOS.
- `expo install --check` confirma dependencias compatibles con SDK 57.
- La exportación Android de Metro/Hermes termina correctamente desde el nuevo
  entry point `index.ts`, con 1948 módulos. Esto valida el bundle, no una APK nativa.
- No se realizaron migraciones ni cambios en el backend.

Se requiere recompilar e instalar las APK development y preview; reiniciar Metro
no incorpora los nuevos permisos ni el módulo nativo. No funciona en Expo Go.

Prueba física pendiente, en cada APK:

1. Permitir ubicación precisa y acceso todo el tiempo al iniciar.
2. Grabar un recorrido libre caminando o pedaleando; abrir otra app y bloquear
   la pantalla durante varios minutos. Comprobar la notificación en Android.
3. Volver, comprobar puntos y distancia, finalizar y guardar; confirmar que
   desaparece la notificación y la actividad contiene el trayecto recorrido.
4. Repetir con una ruta buscada, guardada o repetida, verificando también el destino
   y la geometría planificada al finalizar.
5. Probar cambio de pestaña, permisos denegados y cierre forzado: recuperar el
   borrador interrumpido sin inventar distancia ni duración.

Referencia: https://docs.expo.dev/versions/v57.0.0/sdk/location/
