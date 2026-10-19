# Perfil, álbumes y acceso con Google

## Funcionalidad

- Editar perfil permite seleccionar y recortar una foto de perfil (1:1) y una
  portada (16:9). Se previsualizan localmente; la subida y la actualización de
  metadatos ocurren al guardar. Salir con cambios pendientes pide confirmación.
- Mi perfil muestra foto y portada propias. Las rutas de Storage se guardan en
  `user_metadata.cycling_profile`; las URLs firmadas temporales no se persisten.
- «Álbumes», accesible desde Perfil y Editar perfil, presenta grupos con nombre,
  fecha de creación y número de archivos. Permite crear grupos independientes,
  cambiarles el nombre y añadir fotos o videos.
- Las fotos existentes de recorridos aparecen agrupadas por actividad, usando su
  nombre y fecha. Se leen directamente de `ride-photos`; no se copian ni se duplican.
  Para añadir fotos a estos grupos se conserva el flujo de Actividad. Los grupos
  independientes pueden contener fotos y videos sin un recorrido asociado.
- Fotos: JPEG, PNG y WebP, hasta 5 MB. Videos: MP4/MOV, hasta 25 MB y un minuto.
  El tamaño y formato tienen validación en cliente y servidor. La duración se
  valida cuando el selector nativo la informa; Storage no analiza la duración.
  Se limita a 30 archivos por álbum con bloqueo transaccional por grupo.
- Los videos se reproducen dentro del álbum, sin reproducción automática. Los
  estados de carga/error y el reintento están disponibles. Un fallo de reproducción
  o un módulo nativo faltante no sustituye toda la aplicación por una pantalla de error.

## Modelo y permisos

Migración preparada: `supabase/migrations/202610190005_profile_albums.sql`.
El usuario la aplicó y después se verificó mediante una consulta remota de solo
lectura: ambas tablas con RLS, ambos buckets privados con los límites esperados,
seis políticas de tablas, seis de Storage y el trigger de capacidad presentes.
El agente no volvió a ejecutar la migración ni escribió SQL en el proyecto remoto.

La migración crea `media_albums`, `album_media` y los buckets privados
`profile-media` y `album-media`. No modifica recorridos, mapas ni funciones de
enrutamiento. RLS limita lectura/escritura a `auth.uid()`. Una clave foránea
compuesta impide asociar archivos a álbumes ajenos. Las rutas de objetos incluyen
usuario, álbum e ID del archivo; los permisos de Storage comprueban también la
propiedad del álbum. Los buckets no pueden ser públicos.

La fecha de creación del álbum es generada por PostgreSQL; el cliente solo puede
actualizar el título. Los archivos tienen UUID estables para reintentar uploads y
upserts sin duplicar registros. Las subidas confirmadas se omiten al reintentar.
Si se abandona después de un fallo entre Storage y el registro de metadatos puede
quedar un objeto privado sin referencia; no se elimina contenido automáticamente.
La limpieza de esos objetos y la eliminación de álbumes/archivos no forman parte
de esta entrega.

Las URLs firmadas duran una hora y se renuevan al volver a la pantalla o actualizar.
Las respuestas tardías de otra sesión se descartan. La lista pagina álbumes
independientes de 50 en 50. La consulta de grupos de recorridos está acotada a
1000 carpetas existentes, sin cargar sus geometrías GPS completas.

## Google

El proveedor Google quedó habilitado en Supabase con `GOOGLE_CLIENT_ID` y
`GOOGLE_CLIENT_SECRET` existentes en `apps/mobile/.env`, mediante PATCH específico
de Auth. No se cambió el sitio base, los proveedores restantes ni las políticas
de autenticación. Se conservaron las URLs permitidas existentes y se añadieron:

```text
cycling-dev://auth/callback
cycling://auth/callback
```

Google Cloud debe tener autorizado este callback en el cliente OAuth de tipo Web:

```text
https://puqbvxrpneujgvzrioqn.supabase.co/auth/v1/callback
```

`GOOGLE_CALLBACK_URL` local apuntaba a `http://localhost:3000/auth/google/callback`.
No se utiliza para el retorno de la aplicación móvil ni se modificó el `.env`.
El propietario confirmó que el callback ya está agregado en Google Cloud.
Supabase devuelve HTTP 302 hacia
`accounts.google.com` con el callback correcto; esto no prueba un acceso completo
con una cuenta real.

El móvil utiliza `signInWithOAuth`, navegador del sistema, PKCE S256 y
`exchangeCodeForSession`. Un adaptador de Expo Crypto aporta aleatoriedad segura
y SHA-256 en Hermes. Los retornos con la aplicación abierta y cerrada comparten
un único intercambio por código. Se validan esquema/host/ruta del callback; los
tokens y códigos no se registran. La sesión se integra con el AuthProvider existente.
Nombre y correo/contraseña siguen funcionando; Google puede crear la cuenta o
iniciar sesión según la configuración habitual de Supabase.

Las claves de Google **no** necesitan prefijo `EXPO_PUBLIC_`, no se importan en
React Native y no necesitan variables EAS para este flujo. El secreto se comprobó
ausente de la exportación Android. El cliente Google y sus permisos quedan en Auth.

Script administrativo, desde la raíz:

```powershell
node scripts/configure-google-auth.cjs
# Solo si se quiere volver a actualizar Google con las credenciales locales:
node scripts/configure-google-auth.cjs --apply
```

El script usa la sesión existente de Supabase CLI en Windows (o
`SUPABASE_ACCESS_TOKEN` de la terminal), sin imprimir credenciales. No ejecuta SQL.
No es necesario ejecutarlo dentro de la app ni incorporarlo a una APK.

## Archivos

- Nuevos: módulo `modules/albums` (pantalla, servicio, reproductor),
  `profile-media.service.ts`, `useProfileMedia.ts`, servicio Google, pantalla de
  callback, rutas `albums.tsx` y `auth/callback.tsx`, `media-upload.ts` y migración.
- Modificados: Editar perfil, Mi perfil, modelo/servicio de perfil, Avatar global,
  formulario y botones de acceso, nombre derivado de usuario Google, cliente
  Supabase PKCE, stack Expo Router, plugins/configuración Expo y dependencias.
- Validación: `profile-media-google.test.cjs`, `check-album-policies.cjs` y comando
  raíz `test`. Herramienta administrativa: `configure-google-auth.cjs` y
  `scripts/lib/supabase-management.cjs`.

## Validación y APK

Resultado: TypeScript correcto, 167/167 pruebas aprobadas, comprobación SQL/RLS
aislada correcta y exportación Android/Hermes completada. El secreto de Google
no se encontró en el bundle generado. La migración fue aplicada por el usuario y
verificada posteriormente en modo de solo lectura.

Se prueban recorte, cancelación, tipos/tamaños/duración, propiedad de imágenes,
reintentos parciales, grupos por recorrido, retorno por variante, cancelación de
Google, intercambio único y SHA-256 nativo. La migración se ejecutó exclusivamente
en PostgreSQL efímero en memoria para comprobar SQL, RLS, separación de cuentas,
rutas de Storage, límite de 30 elementos, reintento al alcanzar el límite y fechas
no editables. No se accedió a la base remota en esa prueba.

Repetir la comprobación aislada desde la raíz:

```powershell
npm install --prefix .expo/album-db-check --no-audit --no-fund --ignore-scripts @electric-sql/pglite
node scripts/check-album-policies.cjs
```

Se añadieron módulos SDK 57 `expo-web-browser`, `expo-video` y `expo-crypto`.
**Es necesario recompilar Cycling Dev y Preview** para incluirlos. Desde
`apps/mobile`:

```powershell
corepack pnpm dlx eas-cli build --platform android --profile development
corepack pnpm dlx eas-cli build --platform android --profile preview
```

No se inició un build EAS. Con la migración aplicada, comprobar en teléfono subida
y persistencia de foto/portada, fotos de actividades, álbum mixto, videos, reintento
de red y Google en ambas variantes. La prueba real de consentimiento de Google
requiere elegir una cuenta del usuario; no se realizó automáticamente.

Referencias oficiales consultadas:

- [Supabase: acceso social con Expo](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
- [Supabase: configurar Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: actualización específica de Auth](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [Expo SDK 57 WebBrowser](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/)
- [Expo SDK 57 Video](https://docs.expo.dev/versions/v57.0.0/sdk/video/)
