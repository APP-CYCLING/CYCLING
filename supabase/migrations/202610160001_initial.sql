-- CYCLING / Supabase Cloud. Ejecutar en SQL Editor una sola vez.
-- Las tablas viven en public y están protegidas con RLS; no se exponen datos privados mediante vistas inseguras.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.cycling_routes (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 distance_km numeric(9,2) not null check(distance_km>=0),
 difficulty text not null check(difficulty in ('easy','moderate','hard')),
 duration_min integer not null check(duration_min>=0),
 ascent_m integer not null default 0 check(ascent_m>=0),
 path extensions.geometry(LineString,4326) not null,
 is_demo boolean not null default false,created_at timestamptz not null default now()
);
create index if not exists cycling_routes_path_gix on public.cycling_routes using gist(path);
create table if not exists public.bike_lanes (
 id uuid primary key default gen_random_uuid(), name text not null,kind text not null default 'dedicated',
 path extensions.geometry(LineString,4326) not null,is_demo boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists bike_lanes_path_gix on public.bike_lanes using gist(path);
create table if not exists public.rides (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 route_id uuid references public.cycling_routes(id) on delete set null,
 distance_km numeric(9,3) not null check(distance_km>=0),
 duration_sec integer not null check(duration_sec>=0),
 path extensions.geometry(LineString,4326),
 started_at timestamptz not null, ended_at timestamptz not null,
 created_at timestamptz not null default now(),
 constraint rides_valid_time check (ended_at>=started_at)
);
create index if not exists rides_user_idx on public.rides(user_id,created_at desc);

alter table public.cycling_routes enable row level security;
alter table public.bike_lanes enable row level security;
alter table public.rides enable row level security;
revoke all on public.cycling_routes,public.bike_lanes,public.rides from anon,authenticated;
grant select on public.cycling_routes,public.bike_lanes to anon,authenticated;
grant select on public.rides to authenticated;
-- No inserts/updates/deletes públicos a rutas ni ciclovías (importación controlada por admin).
create policy "Everyone can read routes" on public.cycling_routes for select to anon,authenticated using (true);
create policy "Everyone can read lanes" on public.bike_lanes for select to anon,authenticated using (true);
create policy "Users read own rides" on public.rides for select to authenticated using ((select auth.uid())=user_id);

-- Vistas invoker: respetan RLS y grants del usuario que consulta.
create or replace view public.routes_public with (security_invoker=true) as
 select id,title,description,distance_km,difficulty,duration_min,ascent_m,is_demo,created_at,
 extensions.ST_AsGeoJSON(path)::jsonb as path_geojson from public.cycling_routes;
create or replace view public.bike_lanes_public with (security_invoker=true) as
 select id,name,kind,is_demo,created_at,extensions.ST_AsGeoJSON(path)::jsonb as path_geojson from public.bike_lanes;
create or replace view public.rides_private with (security_invoker=true) as
 select id,user_id,route_id,distance_km,duration_sec,started_at,ended_at,created_at,
 case when path is null then null else extensions.ST_AsGeoJSON(path)::jsonb end as path_geojson
 from public.rides;
grant select on public.routes_public,public.bike_lanes_public to anon,authenticated;
grant select on public.rides_private to authenticated;

-- Escritura controlada: auth.uid() se obtiene en el servidor y nunca lo envía el cliente.
create or replace function public.save_ride(
 p_route_id uuid,p_distance_km numeric,p_duration_sec integer,
 p_started_at timestamptz,p_ended_at timestamptz,p_track jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; g extensions.geometry;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_distance_km is null or p_distance_km<0 or p_distance_km>5000 then raise exception 'Invalid distance'; end if;
 if p_duration_sec is null or p_duration_sec<0 or p_duration_sec>2592000 then raise exception 'Invalid duration'; end if;
 if p_started_at is null or p_ended_at is null or p_ended_at<p_started_at or p_started_at>now()+interval '5 minutes' then raise exception 'Invalid dates'; end if;
 if p_track is not null then
  if jsonb_typeof(p_track->'coordinates') <> 'array' or jsonb_array_length(p_track->'coordinates')<2 or jsonb_array_length(p_track->'coordinates')>10000 then raise exception 'Invalid track';end if;
  g:=extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_track::text),4326);
  if extensions.ST_GeometryType(g)<>'ST_LineString' or not extensions.ST_IsValid(g) then raise exception 'Invalid geometry'; end if;
 end if;
 insert into public.rides(user_id,route_id,distance_km,duration_sec,started_at,ended_at,path)
 values((select auth.uid()),p_route_id,p_distance_km,p_duration_sec,p_started_at,p_ended_at,g) returning id into new_id;
 return new_id;
end $$;
revoke all on function public.save_ride(uuid,numeric,integer,timestamptz,timestamptz,jsonb) from public,anon;
grant execute on function public.save_ride(uuid,numeric,integer,timestamptz,timestamptz,jsonb) to authenticated;
