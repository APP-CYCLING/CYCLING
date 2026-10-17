# Nombres de recorridos y cancelaciones del mapa

## Guardado con nombre

Al finalizar se detiene el registro y se abre un formulario nativo. El nombre es opcional; vacío produce, por ejemplo, `Parque Kennedy · 16/10/2026 · Tarde`.

Se toma el destino elegido al iniciar el recorrido y la fecha/hora local de finalización. Los períodos son madrugada (00–05), mañana (06–11), tarde (12–18) y noche (19–23). Sin un destino elegido se usa `Recorrido libre`; no se inventa una dirección a partir de las coordenadas.

El nombre admite 160 caracteres. El formulario conserva el nombre y la instantánea del recorrido cuando falla una petición o se cierra para guardar más tarde. El botón «Guardar recorrido detenido» lo reabre. Hay protección frente a pulsaciones simultáneas de guardar. Los datos pendientes permanecen en memoria: es necesario completar el guardado antes de cerrar la app.

El título se muestra en Inicio, Actividad, detalle y Perfil. Los recorridos antiguos sin título reciben un nombre de presentación automático; no se alteran sus registros.

## Activación de la base de datos — pendiente

La app necesita `supabase/migrations/202610160003_ride_names.sql`. El archivo:

- Añade `title` y `destination_name`, permitiendo conservar todos los registros existentes.
- Amplía la vista privada sin cambiar las columnas anteriores ni sus políticas.
- Añade `save_named_ride`, que reutiliza las validaciones del RPC anterior y guarda geometría, métricas y título en una misma transacción.
- Conserva `save_ride` para los clientes anteriores y restringe el nuevo RPC a usuarios autenticados.

**Esta migración no se ejecutó**, respetando la instrucción previa del usuario de no ejecutar migraciones. Hasta aplicarla, el formulario informa que falta la migración y conserva el recorrido para reintentar; no lo guarda silenciosamente sin nombre.

Para activarla, abrir SQL Editor del proyecto cycling en Supabase y ejecutar **solo el contenido de `202610160003_ride_names.sql`**. Después reintentar guardar desde la app.

La consulta de solo lectura `supabase migration list --linked` muestra que las migraciones anteriores no están registradas como aplicadas en el historial de la CLI. No usar `db push` para este paso: intentaría incluir también las migraciones anteriores. No se ejecutó `migration repair` ni ninguna escritura sobre la base de datos.

## MapLibre

`stream was reset: CANCEL` corresponde a una petición cancelada. Por sí solo no demuestra una clave incorrecta. El SDK instalado ya rebaja algunos mensajes de cancelación `Canceled`, pero esta variante HTTP/2 puede aparecer como error de sprite o fuentes.

Se corrigieron dos fuentes de trabajo innecesario:

- Ampliar/reducir el mapa de Pedalear conserva el mismo componente nativo, padre y clave de React. Antes se desmontaba y se creaba de nuevo en otra rama de la interfaz.
- La cámara puede centrarse al terminar la carga del estilo; ya no espera todas las teselas de la vista mundial inicial. Se desactiva el recorte de vistas en los contenedores desplazables que alojan los mapas.

No se silencian los errores de MapLibre. Las descargas también pueden cancelarse al abandonar una pantalla, cambiar el mapa del historial, poner la aplicación en segundo plano o por problemas de red.

Comprobación desde este equipo: estilo, JSON de sprites y fuentes respondieron HTTP 200. Una imagen sprite sufrió un reseteo de conexión en la primera petición y respondió HTTP 200 al reintentar. Esto confirma que hubo un fallo transitorio de transporte en esa comprobación; no permite atribuir todos los mensajes del teléfono a una sola causa. No se mostraron claves en los registros del diagnóstico.

## Archivos principales

- `apps/mobile/src/modules/rides/utils/ride-name.ts`
- `apps/mobile/src/modules/rides/components/SaveRideDialog.tsx`
- `apps/mobile/src/modules/rides/hooks/useRideController.ts`
- `apps/mobile/src/modules/rides/components/RideLayout.tsx`
- `apps/mobile/src/modules/rides/screens/RideScreen.tsx`
- `apps/mobile/src/modules/rides/services/rides.service.ts`
- `apps/mobile/src/modules/rides/components/RideCard.tsx`
- `apps/mobile/src/modules/rides/components/ActivityRideCard.tsx`
- `apps/mobile/src/modules/rides/screens/ActivityScreen.tsx`
- `apps/mobile/src/modules/profile/screens/ProfileScreen.tsx`
- `apps/mobile/src/modules/maps/components/NativeCyclingMap.tsx`
- `apps/mobile/src/shared/components/UI.tsx`
- `apps/mobile/src/shared/supabase/mappers.ts`
- `packages/contracts/src/index.ts`
- `supabase/migrations/202610160003_ride_names.sql`
- `scripts/ride-saving.test.cjs` y comando `test` en `package.json`.

## Verificación

- TypeScript correcto y 41 pruebas aprobadas, con regresiones de nombres, RPC, compatibilidad, reintento, destino capturado y estabilidad del componente del mapa.
- Exportación Android/iOS correcta en `.expo/ride-names-validation`.
- Pendiente ejecutar la migración y probar el flujo completo con un teléfono y una cuenta reales. No se certifica la desaparición de todas las cancelaciones de red únicamente mediante pruebas JavaScript.
