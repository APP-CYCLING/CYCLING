import { getSupabase } from "../../../shared/supabase/client";
import {
  profileFromMetadata,
  validateProfile,
  type CyclingProfile,
} from "../utils/profile-model";
async function currentUser(expectedId: string) {
  const { data, error } = await getSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedId)
    throw new Error("Tu sesión cambió. Vuelve a abrir tu perfil.");
  return data.user;
}
export const profileService = {
  async get(userId: string): Promise<CyclingProfile> {
    const user = await currentUser(userId);
    return profileFromMetadata(
      user.email?.split("@")[0] || "Ciclista",
      user.user_metadata,
    );
  },
  async update(userId: string, input: CyclingProfile): Promise<CyclingProfile> {
    const valid = validateProfile(input);
    const user = await currentUser(userId);
    const { name, ...cyclingProfile } = valid;
    const previous = user.user_metadata.cycling_profile;
    const { data, error } = await getSupabase().auth.updateUser({
      data: {
        name,
        cycling_profile: {
          ...(previous &&
          typeof previous === "object" &&
          !Array.isArray(previous)
            ? previous
            : {}),
          ...cyclingProfile,
        },
      },
    });
    if (error) throw error;
    if (!data.user || data.user.id !== userId)
      throw new Error("No se pudo confirmar el perfil actualizado.");
    return profileFromMetadata(name, data.user.user_metadata);
  },
};
