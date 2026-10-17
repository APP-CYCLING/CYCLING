-- Aditiva: conserva recorridos, políticas y el RPC save_ride anterior.
begin;
alter table public.rides add column if not exists title text;
alter table public.rides add column if not exists destination_name text;

-- Las columnas nuevas van al final para conservar la firma de la vista existente.
create or replace view public.rides_private with (security_invoker=true) as
 select id,user_id,route_id,distance_km,duration_sec,started_at,ended_at,created_at,
 case when path is null then null else extensions.ST_AsGeoJSON(path)::jsonb end as path_geojson,
 title,destination_name
 from public.rides;
grant select on public.rides_private to authenticated;

-- Reutiliza todas las validaciones de geometría, métricas y autenticación.
-- El INSERT y el nombre se guardan en la misma transacción.
create or replace function public.save_named_ride(
 p_title text,p_destination_name text,
 p_route_id uuid,p_distance_km numeric,p_duration_sec integer,
 p_started_at timestamptz,p_ended_at timestamptz,p_track jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare ride_id uuid; owner_id uuid := (select auth.uid());
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if p_title is null or char_length(btrim(p_title))=0 or char_length(p_title)>160 then
  raise exception 'Invalid ride title';
 end if;
 if p_destination_name is not null and char_length(p_destination_name)>500 then
  raise exception 'Invalid destination name';
 end if;
 ride_id := public.save_ride(p_route_id,p_distance_km,p_duration_sec,p_started_at,p_ended_at,p_track);
 update public.rides set title=btrim(p_title),destination_name=nullif(btrim(p_destination_name),'')
 where id=ride_id and user_id=owner_id;
 if not found then raise exception 'Could not attach ride title'; end if;
 return ride_id;
end $$;
revoke all on function public.save_named_ride(text,text,uuid,numeric,integer,timestamptz,timestamptz,jsonb) from public,anon;
grant execute on function public.save_named_ride(text,text,uuid,numeric,integer,timestamptz,timestamptz,jsonb) to authenticated;
commit;
