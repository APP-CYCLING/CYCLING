import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../auth/context/AuthContext";
import { profileService } from "../services/profile.service";
import type { CyclingProfile } from "../utils/profile-model";
export function useCyclingProfile() {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner?: string;
    profile: CyclingProfile | null;
    loading: boolean;
    error: string;
  }>({ profile: null, loading: !!user, error: "" });
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setState({ owner: user?.id, profile: null, loading: !!user, error: "" });
      if (user)
        void profileService
          .get(user.id)
          .then((profile) => {
            if (current)
              setState({ owner: user.id, profile, loading: false, error: "" });
          })
          .catch((e: unknown) => {
            if (current)
              setState({
                owner: user.id,
                profile: null,
                loading: false,
                error:
                  e instanceof Error
                    ? e.message
                    : "No se pudo cargar el perfil.",
              });
          });
      return () => {
        current = false;
      };
    }, [user?.id, revision]),
  );
  return {
    profile: state.owner === user?.id ? state.profile : null,
    loading: state.owner !== user?.id ? !!user : state.loading,
    error: state.owner === user?.id ? state.error : "",
    refresh: () => setRevision((value) => value + 1),
  };
}
