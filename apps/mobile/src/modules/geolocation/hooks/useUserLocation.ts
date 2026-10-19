import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import { useScreenFocused } from "../../../shared/hooks/useScreenFocused";
import { locationService } from "../services/location.service";
import {
  initialLocationState,
  startLocationSession,
} from "../services/location-session";
import { isFreshFix } from "../utils/location-policy";

export function useUserLocation(watchEnabled = true) {
  const focused = useScreenFocused();
  // Android puede iniciar currentState=null. Inactive incluye diálogos del SO,
  // por lo que solo background interrumpe esta sesión de primer plano.
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background",
  );
  const [attempt, setAttempt] = useState(0),
    [state, setState] = useState(initialLocationState);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (value) =>
      setForeground(value !== "background"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!focused || !foreground || !watchEnabled) return;
    return startLocationSession(locationService, setState);
  }, [attempt, focused, foreground, watchEnabled]);
  const request = useCallback(() => {
    if (!state.loading) setAttempt((value) => value + 1);
  }, [state.loading]);
  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() =>
      setState((value) => ({
        ...value,
        loading: false,
        error:
          "Abre Ajustes del teléfono → Apps → cycling → Permisos → Ubicación.",
      })),
    );
  }, []);
  const fix = focused && foreground && isFreshFix(state.fix) ? state.fix : null;
  return {
    ...state,
    fix,
    position: fix?.coordinate ?? null,
    loading: focused && foreground && state.loading,
    focused: focused && foreground,
    request,
    openSettings,
  };
}
