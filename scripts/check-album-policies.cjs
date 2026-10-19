// Ephemeral, in-memory PostgreSQL only. Never connects to a Supabase project.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { PGlite } = require(
  path.resolve(".expo/album-db-check/node_modules/@electric-sql/pglite"),
);
(async () => {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage,public to authenticated,anon;
 grant select,insert,update on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/202610190005_profile_albums.sql",
      "utf8",
    ),
  );
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222",
    aa = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    bb = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    photo = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await db.query(
    "insert into public.media_albums(id,user_id,title) values($1,$2,$3),($4,$5,$6)",
    [aa, a, "Playa", bb, b, "Privado"],
  );
  assert.ok(
    (await db.query("select public from storage.buckets")).rows.every(
      (r) => r.public === false,
    ),
  );
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  assert.equal(
    (await db.query("select * from public.media_albums")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.media_albums where id=$1", [bb])).rows
      .length,
    0,
  );
  await db.query("update public.media_albums set title=$1 where id=$2", [
    "Salida por la playa",
    aa,
  ]);
  await assert.rejects(
    db.query("update public.media_albums set created_at=now() where id=$1", [
      aa,
    ]),
  );
  await assert.rejects(
    db.query("insert into public.media_albums(user_id,title) values($1,$2)", [
      b,
      "Foreign",
    ]),
  );
  await assert.rejects(
    db.query(
      "insert into public.album_media(id,album_id,user_id,storage_path,media_type,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7)",
      [photo, bb, a, `${a}/${bb}/${photo}.jpg`, "image", "image/jpeg", 100],
    ),
  );
  await db.query(
    "insert into public.album_media(id,album_id,user_id,storage_path,media_type,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7)",
    [photo, aa, a, `${a}/${aa}/${photo}.jpg`, "image", "image/jpeg", 100],
  );
  await db.query("insert into storage.objects values($1,$2)", [
    "album-media",
    `${a}/${aa}/${photo}.jpg`,
  ]);
  await db.query("insert into storage.objects values($1,$2)", [
    "profile-media",
    `${a}/avatar/test.jpg`,
  ]);
  await assert.rejects(
    db.query("insert into storage.objects values($1,$2)", [
      "album-media",
      `${a}/${bb}/forged.jpg`,
    ]),
  );
  await assert.rejects(
    db.query("insert into storage.objects values($1,$2)", [
      "profile-media",
      `${b}/cover/forged.jpg`,
    ]),
  );
  for (let i = 0; i < 29; i++) {
    const id = require("node:crypto").randomUUID();
    await db.query(
      "insert into public.album_media(id,album_id,user_id,storage_path,media_type,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7)",
      [id, aa, a, `${a}/${aa}/${id}.jpg`, "image", "image/jpeg", 100],
    );
  }
  const extra = require("node:crypto").randomUUID();
  await assert.rejects(
    db.query(
      "insert into public.album_media(id,album_id,user_id,storage_path,media_type,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7)",
      [extra, aa, a, `${a}/${aa}/${extra}.jpg`, "image", "image/jpeg", 100],
    ),
  );
  await db.query(
    "insert into public.album_media(id,album_id,user_id,storage_path,media_type,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set size_bytes=excluded.size_bytes",
    [photo, aa, a, `${a}/${aa}/${photo}.jpg`, "image", "image/jpeg", 101],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  assert.equal(
    (await db.query("select * from public.album_media")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.media_albums"));
  await db.exec("reset role");
  await db.close();
  console.log(
    "Ephemeral PostgreSQL: migration syntax, private buckets, RLS, cross-account ownership, storage paths and immutable creation dates passed. No remote database changed.",
  );
})().catch(() => {
  console.error(
    "Album SQL policy check failed. No remote database was accessed.",
  );
  process.exitCode = 1;
});
