# Stitch — Perfil, Editar perfil y Actividad

Se revisaron los HTML, estilos, capturas y recursos de estas tres exportaciones nuevas:

| Diseño                                         | Pantalla nativa                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `diseño/perfil_usuario_ciclista`               | Pestaña Perfil: identidad, bicicleta principal, rendimiento, objetivo mensual, insignias y configuración.                 |
| `diseño/editar_perfil_usuario_ciclista`        | Nueva ruta Expo Router `/edit-profile`: formulario con portada, identidad, métricas opcionales, preferencias y bicicleta. |
| `diseño/actividad_historial_de_rutas_grabadas` | Pestaña Actividad: filtros, resumen, gráfico semanal, historial agrupado por día y detalle de recorridos.                 |

Se mantienen Inter, paleta lima, superficies claras, tarjetas redondeadas, jerarquía tipográfica y áreas seguras. La portada ilustrativa se recuperó del propio HTML; el avatar representa las iniciales de la cuenta, no la persona de ejemplo de Stitch.

## Qué funciona

- **Perfil:** nombre y ciudad reales, bicicleta principal, tiempo/distancia/cantidad de salidas, progreso mensual e insignias derivadas de recorridos. Acceso a edición, mapa, historial, compartir resumen y cierre de sesión.
- **Editar perfil:** guarda nombre, alias, ubicación, biografía, modalidad, frecuencia, peso/estatura opcionales, bicicleta principal y objetivo mensual. Valida longitudes y rangos, acepta decimales con coma y maneja errores, guardado y descarte de cambios. El botón de retroceso de Android también contempla los cambios pendientes.
- **Actividad:** filtra por semana, mes, año actual o historial; muestra distancia, duración y velocidad media ponderada. El gráfico representa kilómetros reales por día de la semana actual. El historial agrupa salidas por fecha, permite cargar más tarjetas, abrir el mapa o el detalle, compartir el resumen semanal y actualizar datos.
- **Mapas de recorridos:** usan MapLibre y las coordenadas guardadas. Solo se monta un mapa del historial a la vez; abrir el detalle sustituye temporalmente el mapa de la tarjeta. No se usan las imágenes ni las curvas ficticias del HTML como cartografía.
- Carga, invitado, ausencia de datos, errores de red, datos opcionales vacíos y reintentos.

La edición usa el método autenticado [`auth.updateUser({ data })`](https://supabase.com/docs/reference/javascript/auth-updateuser). El nombre sigue en `user_metadata.name` para conservar la integración con la sesión; el resto se guarda bajo `user_metadata.cycling_profile`. El servicio comprueba que la sesión corresponde a la cuenta que abrió el editor. Estos metadatos son preferencias editables y nunca se utilizan para autorización.

No se necesitan migraciones. No se modificaron consultas de recorridos, políticas RLS, Edge Functions, servicios de mapas ni GPS. Las pruebas del servicio de perfil usan respuestas simuladas; no modificaron una cuenta real.

## Archivos modificados

- `apps/mobile/src/modules/profile/screens/ProfileScreen.tsx`
- `apps/mobile/src/modules/rides/screens/ActivityScreen.tsx`
- `apps/mobile/src/app/_layout.tsx`
- `package.json`: añade las pruebas nuevas al comando existente.
- `apps/mobile/assets/images/stitch/README.md`: procedencia de la portada.
- `docs/STITCH_IMPLEMENTATION.md`: enlace y correspondencia con esta ampliación.

## Archivos creados

- `apps/mobile/src/app/edit-profile.tsx`
- `apps/mobile/src/modules/profile/screens/EditProfileScreen.tsx`
- `apps/mobile/src/modules/profile/components/ProfileUI.tsx`: campos, títulos y filas de configuración.
- `apps/mobile/src/modules/profile/hooks/useCyclingProfile.ts`
- `apps/mobile/src/modules/profile/services/profile.service.ts`
- `apps/mobile/src/modules/profile/utils/profile-model.ts`
- `apps/mobile/src/modules/rides/components/ActivityChart.tsx`
- `apps/mobile/src/modules/rides/components/ActivityRideCard.tsx`
- `apps/mobile/src/modules/rides/components/RecordedRideMap.tsx`
- `apps/mobile/src/modules/rides/utils/activity-summary.ts`
- `apps/mobile/assets/images/stitch/profile-cover.jpg`
- `scripts/profile-activity.test.cjs`
- `docs/STITCH_PROFILE_ACTIVITY.md`

## Diferencias respecto a los datos ficticios de Stitch

- El historial conserva el límite existente de 100 salidas. Las estadísticas, objetivos e insignias se calculan sobre los datos cargados; se indica ese alcance.
- El objetivo mensual inicial es 250 km y se puede cambiar en el editor. Las insignias son hitos locales calculados a partir del historial, no un sistema remoto de niveles o verificaciones.
- No se inventan CO₂ ahorrado, árboles, calorías, desnivel, porcentajes de ciclovía, clasificación por modalidad ni nombre geográfico de un trayecto cuando el registro no los contiene.
- Los filtros de modalidad del HTML requieren que cada recorrido almacene su modalidad; por ahora se muestran todos los recorridos y funcionan los filtros temporales.
- Favoritos, importación/exportación de archivos GPX/FIT, sincronización con Strava/Garmin, sensores, fotos de perfil, varias bicicletas, perfiles públicos, seguidores y exclusión de zonas de inicio/fin quedan pendientes.
- La configuración explica la privacidad actual. No hay interruptores que prometan ocultar 500 m de un trazado sin aplicar ese tratamiento.

## Validaciones

- TypeScript: correcto.
- Pruebas: 34 correctas. Las 8 nuevas cubren compatibilidad de metadatos, validaciones, sesión cambiada, persistencia y errores del perfil, límites de fecha y cálculo de estadísticas.
- Expo Doctor: 21/21 comprobaciones correctas.
- Bundles Metro/Hermes Android/iOS: correctos en `.expo/profile-activity-validation`.
- Pendiente la revisión visual en Android/iOS y una prueba de edición/guardado con una cuenta real. No hay un dispositivo o navegador conectado disponible en este entorno para certificar esos flujos en ejecución.
