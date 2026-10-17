import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Ride } from "@cycling/contracts";
import { useAuth } from "../../auth/context/AuthContext";
import { ridesService } from "../services/rides.service";

/** Clears private data on account changes and ignores responses after blur. */
export function useRideHistory() {
  const { user } = useAuth();
  const [state, setState] = useState<{
    owner?: string;
    rides: Ride[];
    loading: boolean;
    error: string;
  }>({ rides: [], loading: !!user, error: "" });
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      setState({ owner: user?.id, rides: [], loading: !!user, error: "" });
      if (user)
        void ridesService
          .list()
          .then((rides) => {
            if (current)
              setState({ owner: user.id, rides, loading: false, error: "" });
          })
          .catch((error: unknown) => {
            if (current)
              setState({
                owner: user.id,
                rides: [],
                loading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "No se pudo cargar tu actividad.",
              });
          });
      return () => {
        current = false;
      };
    }, [user?.id, revision]),
  );
  return {
    rides: state.owner === user?.id ? state.rides : [],
    loading: state.owner !== user?.id ? !!user : state.loading,
    error: state.owner === user?.id ? state.error : "",
    refresh: () => setRevision((value) => value + 1),
  };
}
