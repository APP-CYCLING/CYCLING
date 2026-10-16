# cycling

Aplicación de ciclismo con React Native, Expo SDK 57, Expo Router y Supabase Cloud. Monorepo pnpm con arquitectura por módulos, mapa MapLibre + MapTiler, planificación Geoapify y capa de infraestructura OSM.

**Estado actual:** las tres Edge Functions están desplegadas y el secreto Geoapify está presente. El esquema de cuotas/caché todavía no está activado; las llamadas geográficas autenticadas fallan cerrado hasta disponer de él. No se ejecutaron migraciones, según la instrucción del usuario. [Estado completo, archivos, despliegue y limitaciones](MAPS_IMPLEMENTATION.md).

## Requisitos

- Node.js 22.13+ y pnpm 10.15.0; usar `corepack pnpm` para respetar la versión del workspace.
- Una compilación propia de cycling. **MapLibre no funciona dentro de Expo Go.**
- Android Studio/SDK y dispositivo para compilar localmente, o una cuenta Expo/EAS para generar un APK remoto.
- Proyecto Supabase Cloud y clave pública MapTiler. No se requiere Docker ni servidor adicional.

## Configuración

El proyecto Supabase existente ya tiene la migración inicial. No repetirla ni ejecutar seed sobre producción.

1. Copiar `apps/mobile/.env.example` a `apps/mobile/.env` si aún no existe y configurar las tres variables públicas.
2. Mantener `GEOAPIFY_API_KEY` exclusivamente en Supabase Secrets. No colocar claves administrativas ni Geoapify en variables EXPO_PUBLIC.
3. Revisar el bloqueo documentado de cuotas/caché antes de probar routing o búsqueda autenticados. La migración aditiva está preparada, sin aplicar.
4. Para EAS, configurar las variables públicas en el entorno del perfil de compilación. Los pasos están en [MAPS_IMPLEMENTATION.md](MAPS_IMPLEMENTATION.md).

## Ejecutar

Desde la raíz, para instalar dependencias y compilar en un equipo Android configurado:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm android
```

Con el development build ya instalado:

```powershell
corepack pnpm dev
```

El QR se abre desde la app cycling instalada. `pnpm android` ejecuta `expo run:android`; `pnpm ios` ejecuta `expo run:ios` y requiere macOS. El perfil EAS `preview` produce un APK con bundle integrado para probar sin Metro.

Si LAN falla, comprobar que teléfono y servidor estén en la misma red y revisar VPN/firewall. El modo tunnel puede ayudar con el transporte, pero no añade MapLibre a Expo Go. Reiniciar Metro al cambiar variables de entorno.

## Funcionalidad

- Autenticación Supabase, sesiones, historial privado y guardado de recorridos mediante RPC.
- Mapa MapTiler con origen/destino seleccionables, GPS con permiso explícito y controles de cámara.
- Buscador y rutas para bicicleta mediante funciones Geoapify autenticadas, pendientes de activar el esquema de consumo.
- Infraestructura OSM clasificada, ventana geográfica acotada y caché; sin sustituir fallos por trazados ficticios.
- Las rutas demo permanecen en la base existente, pero se excluyen del catálogo consultado por la app y del mapa.

## Validar

```powershell
corepack pnpm check
corepack pnpm --filter @cycling/contracts check
corepack pnpm test
```

También se ejecutaron Expo Doctor, chequeo de dependencias, Deno check, exportaciones Android/web y prebuild Android aislado. No se compiló un APK ni se validó el renderizado en un teléfono físico.

El registro es de primer plano y se detiene al dejar Pedalear o pasar a segundo plano; al volver puede guardarse lo registrado. No hay seguimiento background, navegación giro a giro, voz ni mapas offline. La calidad y cobertura dependen de los datos geográficos disponibles.

[Arquitectura](ARCHITECTURE.md) · [Auditoría previa a la migración de mapas](AUDIT.md) · [Implementación actual](MAPS_IMPLEMENTATION.md)
