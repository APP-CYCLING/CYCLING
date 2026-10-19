import { getSupabase } from "../supabase/client";
export type MediaDraft = {
  id: string;
  uri: string;
  mime: string;
  extension: string;
  type: "image" | "video";
};
export const PHOTO_LIMIT = 5 * 1024 * 1024,
  VIDEO_LIMIT = 25 * 1024 * 1024;
const formats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};
export async function mediaOwner(expected?: string) {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user || (expected && expected !== data.user.id))
    throw new Error("Tu sesión cambió. Vuelve a iniciar sesión.");
  return data.user.id;
}
export async function pickMedia({
  remaining = 10,
  kind,
}: { remaining?: number; kind?: "avatar" | "cover" } = {}): Promise<
  MediaDraft[]
> {
  const picker = await import("expo-image-picker").catch(() => {
    throw new Error(
      "Instala una nueva APK de CYCLING para seleccionar imágenes y videos.",
    );
  });
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: kind ? ["images"] : ["images", "videos"],
    allowsEditing: !!kind,
    aspect: kind === "avatar" ? [1, 1] : [16, 9],
    allowsMultipleSelection: !kind,
    selectionLimit: kind ? 1 : Math.max(1, remaining),
    quality: 0.8,
    exif: false,
    videoMaxDuration: 60,
  });
  if (result.canceled) return [];
  const { randomUUID } = await import("expo-crypto").catch(() => {
    throw new Error(
      "Instala una nueva APK de CYCLING para guardar tus archivos.",
    );
  });
  return result.assets.slice(0, kind ? 1 : remaining).map((asset) => {
    const mime =
        asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      extension = formats[mime];
    if (!extension || (kind && asset.type === "video"))
      throw new Error("Selecciona JPG, PNG, WebP, MP4 o MOV.");
    const type = mime.startsWith("video/") ? "video" : "image";
    if ((asset.fileSize ?? 0) > (type === "video" ? VIDEO_LIMIT : PHOTO_LIMIT))
      throw new Error("Máximo 5 MB por foto y 25 MB por video.");
    if (type === "video" && (asset.duration ?? 0) > 60000)
      throw new Error("Selecciona videos de hasta un minuto.");
    return { id: randomUUID(), uri: asset.uri, mime, extension, type };
  });
}
export function mediaError(error: { message: string; code?: string }) {
  return new Error(
    /not found|does not exist|schema cache|PGRST205|42P01/i.test(
      `${error.code} ${error.message}`,
    )
      ? "Falta habilitar el almacenamiento de perfil y álbumes en Supabase (migración 202610190005_profile_albums.sql)."
      : "No se pudo guardar o cargar el archivo. Reintenta.",
  );
}
export async function uploadMedia(
  bucket: "profile-media" | "album-media",
  path: string,
  asset: MediaDraft,
) {
  const { File } = await import("expo-file-system");
  const bytes = await new File(asset.uri).arrayBuffer();
  if (
    !bytes.byteLength ||
    bytes.byteLength > (asset.type === "video" ? VIDEO_LIMIT : PHOTO_LIMIT)
  )
    throw new Error("Máximo 5 MB por foto y 25 MB por video.");
  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: asset.mime, upsert: true });
  if (error) throw mediaError(error);
  return bytes.byteLength;
}
export async function signedMedia(
  bucket: "profile-media" | "album-media",
  paths: string[],
) {
  if (!paths.length) return new Map<string, string>();
  const { data, error } = await getSupabase()
    .storage.from(bucket)
    .createSignedUrls(paths, 3600);
  if (error) throw mediaError(error);
  if (data?.some((item) => item.error || !item.signedUrl))
    throw new Error(
      "No se pudieron abrir algunos archivos. Actualiza para reintentar.",
    );
  return new Map((data ?? []).map((item) => [item.path!, item.signedUrl!]));
}
