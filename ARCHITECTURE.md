# Arquitectura modular de cycling

- `apps/mobile/src/app`: rutas y navegación (Expo Router); sin lógica de base de datos.
- `apps/mobile/src/modules/<dominio>`: `components/`, `services/`, `hooks/`, `context/` según aplique.
- `apps/mobile/src/shared`: cliente Supabase, configuración, UI, estilos y mapeadores geográficos compartidos por el frontend.
- `packages/contracts`: tipos de dominio compartibles, libres de dependencias de React Native.
- `supabase/migrations`: estructura relacional, vistas `security_invoker`, políticas RLS, índices geográficos, funciones SQL.
- `supabase/functions`: funciones Edge para lógica de backend que no encaje en Postgres; `health` como ejemplo.

Flujo: React Native → Supabase Auth / PostgREST (Data API) / RPC → PostgreSQL + PostGIS.
No existe servidor NestJS y NO es necesario Docker cuando usas Supabase Cloud.

## Seguridad
- La app contiene solo URL y clave publicable (anon/publishable), nunca `service_role` ni credenciales SQL.
- RLS protege los recorridos; el id propietario se deriva de `auth.uid()` dentro de la función SQL.
- Nadie escribe rutas/ciclovías desde el cliente; deben importarse por procesos administrativos confiables.
- Las vistas son `security_invoker` para heredar las políticas base.
- Tracking de GPS SOLO en primer plano; no hay instrucciones de navegación segura todavía.

## Evolución
- Agregar motor de ruteo externo validado (Valhalla/GraphHopper/etc.) detrás de funciones Edge.
- Importar datos reales de OpenStreetMap con atribución, actualización y auditoría.
- Implementar manejo offline, seguimiento background con consentimiento, test end-to-end y cobertura de seguridad antes de producción.

## Mapas y planificación

MapLibre + MapTiler renderizan el mapa nativo; geolocation gestiona permisos y ubicación de primer plano; route-planner coordina búsqueda y routing; bike-lanes consulta infraestructura OSM acotada y cacheada. Las integraciones facturables pasan por Edge Functions autenticadas. [Estado, despliegue y validación](MAPS_IMPLEMENTATION.md). El esquema aditivo de cuotas/caché está preparado y no fue aplicado.
