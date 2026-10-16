-- Aditiva: no modifica tablas de rutas ni recorridos existentes.
create table public.map_request_buckets (
 scope text not null,
 window_start timestamptz not null,
 requests integer not null check (requests > 0),
 primary key(scope,window_start)
);
create index map_request_buckets_expiry_idx on public.map_request_buckets(window_start);
alter table public.map_request_buckets enable row level security;
revoke all on public.map_request_buckets from public,anon,authenticated;
grant all on public.map_request_buckets to service_role;

create table public.osm_cycleway_cache (
 cache_key text primary key,
 geojson jsonb not null check (jsonb_typeof(geojson)='object'),
 expires_at timestamptz not null
);
create index osm_cycleway_cache_expiry_idx on public.osm_cycleway_cache(expires_at);
alter table public.osm_cycleway_cache enable row level security;
revoke all on public.osm_cycleway_cache from public,anon,authenticated;
grant all on public.osm_cycleway_cache to service_role;

create function public.consume_map_quota(p_action text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 user_min integer; user_day integer; global_min integer; global_day integer;
 quota record; consumed integer;
begin
 if p_user_id is null then return false; end if;
 case p_action
  when 'route' then user_min:=8; user_day:=150; global_min:=100; global_day:=5000;
  when 'search' then user_min:=30; user_day:=600; global_min:=300; global_day:=15000;
  when 'lanes' then user_min:=6; user_day:=100; global_min:=12; global_day:=1000;
  else return false;
 end case;
 -- Los límites se consumen atómicamente por fila; un rechazo posterior puede
 -- gastar un cupo previo pero nunca permite exceder el límite.
 for quota in select * from (values
  (p_action||':user-minute:'||p_user_id::text,date_trunc('minute',now()),user_min),
  (p_action||':user-day:'||p_user_id::text,date_trunc('day',now()),user_day),
  (p_action||':global-minute',date_trunc('minute',now()),global_min),
  (p_action||':global-day',date_trunc('day',now()),global_day)
 ) as q(scope,window_start,maximum)
 loop
  consumed:=null;
  insert into public.map_request_buckets as b(scope,window_start,requests)
   values(quota.scope,quota.window_start,1)
   on conflict(scope,window_start) do update set requests=b.requests+1
   where b.requests<quota.maximum
   returning requests into consumed;
  if consumed is null then return false; end if;
 end loop;
 delete from public.map_request_buckets where window_start<now()-interval '2 days';
 delete from public.osm_cycleway_cache where expires_at<now()-interval '1 day';
 return true;
end $$;
revoke all on function public.consume_map_quota(text,uuid) from public,anon,authenticated;
grant execute on function public.consume_map_quota(text,uuid) to service_role;
