begin;

create table public.media_albums (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create index media_albums_owner_created on public.media_albums(user_id,created_at desc);
create table public.album_media (
 id uuid primary key,
 album_id uuid not null,
 user_id uuid not null default auth.uid(),
 storage_path text not null unique,
 media_type text not null check(media_type in ('image','video')),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime')),
 size_bytes integer not null check(size_bytes between 1 and 26214400),
 created_at timestamptz not null default now(),
 foreign key(album_id,user_id) references public.media_albums(id,user_id) on delete cascade,
 check(storage_path=user_id::text||'/'||album_id::text||'/'||id::text||case mime_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' when 'video/mp4' then '.mp4' else '.mov' end),
 check((media_type='image' and mime_type like 'image/%' and size_bytes<=5242880) or (media_type='video' and mime_type like 'video/%'))
);
create index album_media_album_created on public.album_media(album_id,created_at);
alter table public.media_albums enable row level security;
alter table public.album_media enable row level security;
revoke all on public.media_albums,public.album_media from public,anon,authenticated;
grant select,insert on public.media_albums to authenticated;
grant update(title) on public.media_albums to authenticated;
grant select,insert,update on public.album_media to authenticated;
create policy "Album owner read" on public.media_albums for select to authenticated using(user_id=(select auth.uid()));
create policy "Album owner create" on public.media_albums for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Album owner rename" on public.media_albums for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Album media owner read" on public.album_media for select to authenticated using(user_id=(select auth.uid()));
create policy "Album media owner insert" on public.album_media for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Album media owner update" on public.album_media for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Serialize additions per album so concurrent devices cannot exceed 30 items.
create function public.check_album_capacity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.media_albums where id=new.album_id and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Album not available'; end if;
 if not exists(select 1 from public.album_media where id=new.id and album_id=new.album_id)
  and (select count(*) from public.album_media where album_id=new.album_id)>=30 then
  raise exception 'Album allows up to 30 items';
 end if;
 return new;
end $$;
revoke all on function public.check_album_capacity() from public,anon,authenticated;
create trigger album_capacity before insert or update on public.album_media for each row execute function public.check_album_capacity();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('profile-media','profile-media',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('album-media','album-media',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
 on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
 if exists(select 1 from storage.buckets where id in ('profile-media','album-media') and public) then
  raise exception 'Profile and album buckets must remain private';
 end if;
end $$;
create policy "Profile media owner read" on storage.objects for select to authenticated using(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Profile media owner insert" on storage.objects for insert to authenticated with check(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text and (storage.foldername(name))[2] in ('avatar','cover'));
create policy "Profile media owner update" on storage.objects for update to authenticated using(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text and (storage.foldername(name))[2] in ('avatar','cover'));
create policy "Album storage owner read" on storage.objects for select to authenticated using(bucket_id='album-media' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.media_albums a where a.id::text=(storage.foldername(name))[2] and a.user_id=(select auth.uid())));
create policy "Album storage owner insert" on storage.objects for insert to authenticated with check(bucket_id='album-media' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.media_albums a where a.id::text=(storage.foldername(name))[2] and a.user_id=(select auth.uid())));
create policy "Album storage owner update" on storage.objects for update to authenticated using(bucket_id='album-media' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.media_albums a where a.id::text=(storage.foldername(name))[2] and a.user_id=(select auth.uid()))) with check(bucket_id='album-media' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.media_albums a where a.id::text=(storage.foldername(name))[2] and a.user_id=(select auth.uid())));
commit;
