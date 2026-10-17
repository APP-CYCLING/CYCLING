-- Additive. Apply AFTER 003. Keeps previous RPCs and existing rides intact.
begin;
alter table public.rides add column if not exists planned_route jsonb;
alter table public.rides add column if not exists destination jsonb;
alter table public.rides add column if not exists stop_position jsonb;
alter table public.rides add column if not exists completion_status text not null default 'unknown'
 check (completion_status in ('unknown','completed','incomplete','unplanned'));

create or replace view public.rides_private with (security_invoker=true) as
 select id,user_id,route_id,distance_km,duration_sec,started_at,ended_at,created_at,
 case when path is null then null else extensions.ST_AsGeoJSON(path)::jsonb end as path_geojson,
 title,destination_name,planned_route,destination,stop_position,completion_status
 from public.rides;
grant select on public.rides_private to authenticated;

create or replace function public.save_planned_ride(
 p_title text,p_destination_name text,p_route_id uuid,p_distance_km numeric,
 p_duration_sec integer,p_started_at timestamptz,p_ended_at timestamptz,
 p_track jsonb default null,p_planned_route jsonb default null,p_destination jsonb default null,p_stop_position jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
 ride_id uuid; owner_id uuid := (select auth.uid());
 planned extensions.geometry; actual extensions.geometry; last_point extensions.geometry;
 target extensions.geometry; status text := 'unplanned'; stop_json jsonb;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if p_stop_position is not null then
  if jsonb_typeof(p_stop_position->'latitude') is distinct from 'number'
   or jsonb_typeof(p_stop_position->'longitude') is distinct from 'number'
   or abs((p_stop_position->>'latitude')::numeric)>90 or abs((p_stop_position->>'longitude')::numeric)>180 then
   raise exception 'Invalid stop position';
  end if;
 end if;
 if (p_planned_route is null) <> (p_destination is null) then raise exception 'Plan and destination must be supplied together'; end if;
 if p_planned_route is not null then
  if jsonb_typeof(p_planned_route->'distanceMeters') is distinct from 'number'
    or jsonb_typeof(p_planned_route->'durationSeconds') is distinct from 'number'
    or (p_planned_route->>'distanceMeters')::numeric <= 0
    or (p_planned_route->>'durationSeconds')::numeric < 0
    or jsonb_typeof(p_destination->'latitude') is distinct from 'number'
    or jsonb_typeof(p_destination->'longitude') is distinct from 'number' then
   raise exception 'Invalid planned route';
  end if;
  if abs((p_destination->>'latitude')::numeric)>90 or abs((p_destination->>'longitude')::numeric)>180 then
   raise exception 'Invalid destination';
  end if;
  planned := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_planned_route->'geometry'),4326);
  if planned is null or extensions.ST_IsEmpty(planned)
    or extensions.GeometryType(planned) not in ('LINESTRING','MULTILINESTRING')
    or extensions.ST_NPoints(planned)>100000 or not extensions.ST_IsValid(planned)
    or extensions.ST_XMin(extensions.Box3D(planned)) < -180 or extensions.ST_XMax(extensions.Box3D(planned)) > 180
    or extensions.ST_YMin(extensions.Box3D(planned)) < -90 or extensions.ST_YMax(extensions.Box3D(planned)) > 90 then
   raise exception 'Invalid planned geometry';
  end if;
  target := extensions.ST_SetSRID(extensions.ST_MakePoint((p_destination->>'longitude')::double precision,(p_destination->>'latitude')::double precision),4326);
  status := 'unknown';
 end if;
 -- Existing RPC validates ownership, metrics, dates and track before inserting.
 ride_id := public.save_named_ride(p_title,p_destination_name,p_route_id,p_distance_km,p_duration_sec,p_started_at,p_ended_at,p_track);
 select path into actual from public.rides where id=ride_id and user_id=owner_id;
 if actual is not null or p_stop_position is not null then
  last_point := case when actual is not null then extensions.ST_EndPoint(actual)
   else extensions.ST_SetSRID(extensions.ST_MakePoint((p_stop_position->>'longitude')::double precision,(p_stop_position->>'latitude')::double precision),4326) end;
  stop_json := jsonb_build_object('latitude',extensions.ST_Y(last_point),'longitude',extensions.ST_X(last_point));
  if planned is not null then
   status := case when extensions.ST_DWithin(last_point::extensions.geography,target::extensions.geography,50)
    and p_distance_km*1000 >= (p_planned_route->>'distanceMeters')::numeric*0.8
    then 'completed' else 'incomplete' end;
  end if;
 end if;
 update public.rides set planned_route=p_planned_route,destination=p_destination,
 stop_position=stop_json,completion_status=status where id=ride_id and user_id=owner_id;
 return ride_id;
end $$;
revoke all on function public.save_planned_ride(text,text,uuid,numeric,integer,timestamptz,timestamptz,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_planned_ride(text,text,uuid,numeric,integer,timestamptz,timestamptz,jsonb,jsonb,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ride-photos','ride-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
-- Fail closed if someone previously created a public bucket with this name.
do $$ begin
 if exists(select 1 from storage.buckets where id='ride-photos' and public) then
  raise exception 'ride-photos must be a private bucket';
 end if;
end $$;
create policy "Ride photo owner read" on storage.objects for select to authenticated
 using(bucket_id='ride-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.rides r where r.id::text=(storage.foldername(name))[2] and r.user_id=(select auth.uid())));
create policy "Ride photo owner insert" on storage.objects for insert to authenticated
 with check(bucket_id='ride-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.rides r where r.id::text=(storage.foldername(name))[2] and r.user_id=(select auth.uid())));
create policy "Ride photo owner update" on storage.objects for update to authenticated
 using(bucket_id='ride-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.rides r where r.id::text=(storage.foldername(name))[2] and r.user_id=(select auth.uid())))
 with check(bucket_id='ride-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.rides r where r.id::text=(storage.foldername(name))[2] and r.user_id=(select auth.uid())));
commit;
