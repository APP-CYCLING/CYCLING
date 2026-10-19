import { getSupabase } from "../../../shared/supabase/client";
import {
  mediaOwner,
  mediaError,
  uploadMedia,
  signedMedia,
  type MediaDraft,
} from "../../../shared/services/media-upload";
import { ridePhotosService } from "../../rides/services/ride-photos.service";
export type Album = {
  id: string;
  title: string;
  createdAt: string;
  kind: "album" | "ride";
  count?: number;
};
export type AlbumItem = { id: string; url: string; type: "image" | "video" };
const titleValue = (value: string) => {
  const title = value.trim();
  if (!title || title.length > 80)
    throw new Error("Pon un nombre de entre 1 y 80 caracteres.");
  return title;
};
export const albumsService = {
  async list(
    limit = 50,
    expectedUser?: string,
  ): Promise<{ albums: Album[]; hasMore: boolean; notice: string }> {
    const uid = await mediaOwner(expectedUser),
      client = getSupabase();
    const [manual, folders] = await Promise.all([
      client
        .from("media_albums")
        .select("id,title,created_at,album_media(count)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit + 1),
      client.storage
        .from("ride-photos")
        .list(uid, { limit: 1000, sortBy: { column: "name", order: "asc" } }),
    ]);
    const notice = manual.error
      ? mediaError(manual.error).message
      : folders.error
        ? "No se pudieron consultar los álbumes de recorridos. Actualiza para reintentar."
        : "";
    const rideIds = (folders.data ?? [])
      .filter((file) => !file.id && /^[0-9a-f-]{36}$/i.test(file.name))
      .map((file) => file.name);
    let rides: Album[] = [];
    if (rideIds.length) {
      const result = await client
        .from("rides_private")
        .select("id,title,destination_name,started_at,ended_at")
        .in("id", rideIds)
        .order("ended_at", { ascending: false })
        .limit(1000);
      if (result.error)
        throw new Error(
          "No se pudieron consultar las fotos de tus recorridos.",
        );
      rides = (result.data ?? []).map((row) => ({
        id: row.id,
        title: row.title || row.destination_name || "Recorrido guardado",
        createdAt: row.ended_at || row.started_at,
        kind: "ride" as const,
      }));
    }
    const albums: Album[] = (manual.data ?? []).slice(0, limit).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      kind: "album",
      count: row.album_media?.[0]?.count ?? 0,
    }));
    return {
      albums: [...albums, ...rides].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      hasMore: (manual.data?.length ?? 0) > limit,
      notice,
    };
  },
  async create(title: string, expectedUser?: string): Promise<Album> {
    const name = titleValue(title),
      uid = await mediaOwner(expectedUser);
    const { data, error } = await getSupabase()
      .from("media_albums")
      .insert({ title: name, user_id: uid })
      .select("id,title,created_at")
      .single();
    if (error) throw mediaError(error);
    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      kind: "album",
      count: 0,
    };
  },
  async rename(album: Album, title: string) {
    if (album.kind !== "album")
      throw new Error(
        "El nombre de este grupo corresponde al recorrido guardado.",
      );
    const name = titleValue(title),
      uid = await mediaOwner();
    const { data, error } = await getSupabase()
      .from("media_albums")
      .update({ title: name })
      .eq("id", album.id)
      .eq("user_id", uid)
      .select("id")
      .single();
    if (error || !data)
      throw new Error("No se pudo cambiar el nombre del álbum.");
    return { ...album, title: name };
  },
  async items(album: Album): Promise<AlbumItem[]> {
    const uid = await mediaOwner();
    if (album.kind === "ride")
      return (await ridePhotosService.list(album.id)).map((photo) => ({
        id: photo.path,
        url: photo.url,
        type: "image",
      }));
    const { data, error } = await getSupabase()
      .from("album_media")
      .select("id,storage_path,media_type")
      .eq("album_id", album.id)
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error) throw mediaError(error);
    const urls = await signedMedia(
      "album-media",
      (data ?? []).map((row) => row.storage_path),
    );
    return (data ?? []).map((row) => ({
      id: row.id,
      url: urls.get(row.storage_path)!,
      type: row.media_type,
    }));
  },
  async upload(album: Album, assets: MediaDraft[], done = new Set<string>()) {
    if (album.kind !== "album")
      throw new Error("Añade fotos al recorrido desde Actividad.");
    const uid = await mediaOwner();
    for (const asset of assets) {
      if (done.has(asset.id)) continue;
      await mediaOwner(uid);
      const path = `${uid}/${album.id}/${asset.id}.${asset.extension}`;
      const size = await uploadMedia("album-media", path, asset);
      const { error } = await getSupabase().from("album_media").upsert(
        {
          id: asset.id,
          album_id: album.id,
          user_id: uid,
          storage_path: path,
          media_type: asset.type,
          mime_type: asset.mime,
          size_bytes: size,
        },
        { onConflict: "id" },
      );
      if (error) throw mediaError(error);
      done.add(asset.id);
    }
  },
};
