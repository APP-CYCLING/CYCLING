# Corrección del arranque en blanco

Se encontró una espera sin límite en el layout raíz: mientras Inter no terminara de cargar y no devolviera error, se renderizaba `null`. También se esperaba la restauración de la sesión sin un límite de tiempo. Estas son rutas capaces de dejar el arranque bloqueado; sin registros del teléfono no se puede atribuir el incidente a una única causa confirmada.

Cambios:

- Pantalla inicial con texto y controles del sistema, independiente de fuentes, iconos y conexión.
- Se oculta el splash nativo cuando esa pantalla ya tiene un layout visible; así no tapa el estado de carga mientras se espera al navegador de rutas.
- La espera inicial de las fuentes se limita a 3 segundos. Después se continúa con la tipografía del sistema. Si Inter termina de cargar más tarde, se aplica sin desmontar las pantallas ni reiniciar la sesión.
- Los textos, campos y pestañas usan fuentes disponibles; no solicitan familias Inter sin registrar.
- La restauración de sesión tiene un límite de 15 segundos y un estado visible de error con Reintentar. Los eventos actuales de autenticación prevalecen sobre lecturas anteriores; se ignoran respuestas después de limpiar el intento o superar el plazo.
- El error boundary del layout ofrece una pantalla visible y reintento si falla la carga de una pantalla.
- No se borran datos, contraseñas, tokens ni sesiones persistidas. No se modifican servicios de mapas ni la base de datos.

Durante la comprobación local, Metro dejó de estar disponible. Se volvió a iniciar el servidor de este proyecto con `expo start --dev-client --clear --port 8081`. La conexión del teléfono necesita la misma red y el servidor de desarrollo activo.

Para cargar la corrección: cerrar CYCLING por completo y volver a abrir el development build desde el QR actual. Si se necesita iniciar Metro manualmente desde la raíz del proyecto, usar:

```powershell
corepack pnpm --filter @cycling/mobile exec expo start --dev-client --clear
```

No hace falta desinstalar la app ni borrar sus datos para estos cambios JavaScript.

Validaciones: TypeScript correcto, 56 pruebas aprobadas y exportaciones Metro/Hermes Android/iOS correctas en `.expo/startup-validation`. Las 6 pruebas nuevas cubren fuentes bloqueadas, visibilidad del arranque, tipografía alternativa, sesión bloqueada, respuestas tardías y recuperación. La comprobación final en el teléfono sigue pendiente; el servidor no tenía dispositivos conectados al inspeccionarlo.

Archivos principales: `src/app/_layout.tsx`, `src/shared/components/StartupScreen.tsx`, `src/shared/components/AppText.tsx`, `src/shared/theme/FontContext.ts`, `src/shared/theme/font-fallback.ts`, `src/modules/auth/services/session-restore.ts`, `src/modules/auth/context/AuthContext.tsx`, consumidores de tipografía en campos/pestañas y `scripts/startup.test.cjs`.
