import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { profileMediaService } from "../services/profile-media.service";
import { useAuth } from "../../auth/context/AuthContext";
import type { CyclingProfile } from "../utils/profile-model";
export function useProfileMedia(profile: CyclingProfile | null) {
  const { user } = useAuth(),
    [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner?: string;
    avatarUrl?: string;
    coverUrl?: string;
    error: string;
  }>({ error: "" });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState({ owner: user?.id, error: "" });
      if (user && (profile?.avatarPath || profile?.coverPath))
        void profileMediaService
          .urls(user.id, profile.avatarPath, profile.coverPath)
          .then((urls) => {
            if (active) setState({ owner: user.id, ...urls, error: "" });
          })
          .catch(() => {
            if (active)
              setState({
                owner: user.id,
                error:
                  "No se pudieron abrir tus imágenes. Actualiza el perfil para reintentar.",
              });
          });
      return () => {
        active = false;
      };
    }, [user?.id, profile?.avatarPath, profile?.coverPath, revision]),
  );
  return {
    ...(state.owner === user?.id ? state : { error: "" }),
    refresh: () => setRevision((v) => v + 1),
  };
}
