# CYCLING — Login y Registro de Stitch

## Diseños revisados

- `diseño/iniciar_sesi_n_cycling/code.html` y `screen.png`.
- `diseño/registro_de_cuenta_cycling/code.html` y `screen.png`.
- `diseño/velocita_urban_mobility/DESIGN.md`.

`velocita_urban_mobility` contiene la guía visual, no una pantalla adicional. Se aplicó su tipografía Inter, fondo verde claro, acentos lima, controles redondeados, espaciados y jerarquía. No hay imágenes nuevas que descargar en los diseños de autenticación; sus iconos se representan con componentes nativos de Expo Vector Icons.

## Implementación

La ruta existente `/auth` presenta las dos interfaces dentro del módulo de autenticación. «Registrarme» cambia a Registro; «Iniciar sesión» vuelve a Login. Se conserva la navegación de todos los accesos existentes a la cuenta. La cabecera nativa anterior se oculta para mostrar una sola cabecera de CYCLING, protegida por el área segura.

Elementos implementados:

- Cabecera con retroceso, símbolo de bicicleta y cuenta.
- Campos con iconos, estados de foco, errores y accesibilidad.
- Mostrar/ocultar contraseña, desactivado durante el envío.
- Validación de correo y campos requeridos; el registro exige nombre de 2–80 caracteres y contraseña de al menos 8. El login admite contraseñas existentes más cortas y delega la verificación al servidor.
- Autofill y teclado adecuados para nombre, correo y contraseña; navegación entre campos, adaptación al teclado y desplazamiento en pantallas pequeñas.
- CTA lima con indicador de carga y protección frente a envíos duplicados.
- Mensajes en español para credenciales incorrectas, correo sin confirmar, límites de intentos y problemas de conexión.
- Confirmación por correo del registro: vuelve al formulario de login, vacía la contraseña y muestra instrucciones. Si Supabase devuelve una sesión inmediata, se conserva la entrada directa a la aplicación.
- Al completar el acceso se vuelve a la pantalla anterior; si `/auth` se abrió directamente, se navega a Inicio. Una respuesta tardía no cambia la navegación si el usuario ya salió.

## Recordar el correo

El interruptor está etiquetado **«Recordar mi correo en este equipo»**. Guarda solo correo y preferencia en una clave propia de AsyncStorage. Desactivarlo elimina el correo recordado. No guarda la contraseña, ni cambia la persistencia actual de la sesión de Supabase.

Una lectura local tardía no sobrescribe un correo que el usuario ya esté escribiendo ni una preferencia que ya cambió. La preferencia se aplica al login correcto; el registro no persiste automáticamente el correo. Un fallo al recordar el correo no invalida una autenticación correcta.

## Elementos pendientes del diseño

- **Strava, Google y Apple:** se muestran con sus iconos y estado desactivado «próximamente». No hay OAuth configurado ni se simulan conexiones.
- **Recuperación de contraseña:** se indica como pendiente. Requiere completar el flujo de correo, retorno a la app y actualización de contraseña; el toast ficticio del HTML no se utiliza.
- **Documentos legales:** el usuario confirmó que todavía no están publicados. Se informa de ese estado; no se añaden enlaces vacíos ni una casilla de aceptación de documentos inexistentes. Cuando se publiquen, se podrán conectar los enlaces y la aceptación correspondiente.

No se alteraron los servicios de login/registro de Supabase, la gestión de la sesión, mapas, GPS, consultas, Edge Functions ni políticas de seguridad. Esta implementación no requiere migraciones ni una compilación nativa nueva por dependencias.

## Archivos

Modificados:

- `apps/mobile/src/app/auth.tsx`: entrada del módulo.
- `apps/mobile/src/app/_layout.tsx`: cabecera propia de autenticación.
- `package.json`: incorpora las pruebas al comando existente.

Creados:

- `apps/mobile/src/modules/auth/screens/AuthScreen.tsx`
- `apps/mobile/src/modules/auth/components/AuthChrome.tsx`
- `apps/mobile/src/modules/auth/components/AuthInput.tsx`
- `apps/mobile/src/modules/auth/hooks/useAuthForm.ts`
- `apps/mobile/src/modules/auth/services/remembered-email.service.ts`
- `apps/mobile/src/modules/auth/utils/auth-form.ts`
- `scripts/auth-ui.test.cjs`
- `docs/STITCH_AUTH_IMPLEMENTATION.md`

## Validaciones

- `corepack pnpm --filter @cycling/mobile check`: correcto.
- `corepack pnpm test`: 50 pruebas correctas, incluidas 9 nuevas sobre autenticación, confirmación, validación, persistencia del correo, respuestas tardías y navegación.
- Bundles Metro/Hermes para Android/iOS: generados en `.expo/auth-stitch-validation`.
- Las pruebas usan servicios simulados; no se crearon cuentas ni se enviaron correos reales. Queda pendiente revisar la apariencia y los flujos en un teléfono con una cuenta real. No hubo navegadores o dispositivos conectados disponibles para esa comprobación visual.
