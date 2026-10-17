import { getSupabase } from "../../../shared/supabase/client";
export type DraftPhoto = {
  id: string;
  uri: string;
  mime: string;
  extension: string;
};
export type RidePhoto = { path: string; url: string };
const MAX_SIZE = 5 * 1024 * 1024;
export async function pickRidePhotos(remaining = 6): Promise<DraftPhoto[]> {
  if (remaining <= 0)
    throw new Error("Puedes añadir hasta 6 fotos por actividad.");
  try {
    // Lazy imports keep existing development builds usable without the new module.
    const picker = await import("expo-image-picker");
    const result = await picker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.75,
      exif: false,
    });
    if (result.canceled) return [];
    return result.assets.slice(0, remaining).map((asset, index) => {
      const mime = asset.mimeType ?? "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
        throw new Error("Selecciona fotos JPG, PNG o WebP.");
      if ((asset.fileSize ?? 0) > MAX_SIZE)
        throw new Error("Cada foto debe pesar como máximo 5 MB.");
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri,
        mime,
        extension:
          mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg",
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /native module|Cannot find|not available/i.test(error.message)
    )
      throw new Error(
        "Para añadir fotos, instala una nueva compilación de desarrollo de CYCLING con el selector de imágenes.",
      );
    throw error;
  }
}
async function owner() {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user)
    throw new Error("Inicia sesión para consultar las fotos.");
  return data.user.id;
}
const storage = () => getSupabase().storage.from("ride-photos");
function storageError(error: { message: string }) {
  return new Error(
    /bucket.*not found/i.test(error.message)
      ? "Falta aplicar 202610160004_ride_details.sql para habilitar las fotos privadas."
      : `No se pudieron guardar o cargar las fotos. ${error.message}`,
  );
}
export const ridePhotosService = {
  async upload(
    rideId: string,
    photos: DraftPhoto[],
    uploaded = new Set<string>(),
  ) {
    if (!photos.length) return;
    const userId = await owner();
    const { File } = await import("expo-file-system");
    for (const photo of photos) {
      if (uploaded.has(photo.id)) continue;
      const bytes = await new File(photo.uri).arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_SIZE)
        throw new Error("Cada foto debe pesar entre 1 byte y 5 MB.");
      const path = `${userId}/${rideId}/${photo.id}.${photo.extension}`;
      const { error } = await storage().upload(path, bytes, {
        contentType: photo.mime,
        upsert: true,
      });
      if (error) throw storageError(error);
      uploaded.add(photo.id);
    }
  },
  async list(rideId: string): Promise<RidePhoto[]> {
    const userId = await owner(),
      prefix = `${userId}/${rideId}`;
    const { data, error } = await storage().list(prefix, {
      limit: 100,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw storageError(error);
    const paths = (data ?? [])
      .filter((file) => file.id)
      .map((file) => `${prefix}/${file.name}`);
    if (!paths.length) return [];
    const { data: signed, error: signingError } =
      await storage().createSignedUrls(paths, 3600);
    if (signingError) throw storageError(signingError);
    if (signed?.some((item) => item.error || !item.signedUrl))
      throw new Error("No se pudieron abrir algunas fotos. Reintenta.");
    return (signed ?? []).map((item) => ({
      path: item.path!,
      url: item.signedUrl!,
    }));
  },
};
