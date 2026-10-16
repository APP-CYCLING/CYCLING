import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useScreenFocused } from "../../../shared/hooks/useScreenFocused";
import type { Coordinate } from "@cycling/contracts";
import type { LocationSubscription } from "expo-location";
import { locationService } from "../services/location.service";

export function useUserLocation() {
  const focused = useScreenFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [enabled, setEnabled] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [position, setPosition] = useState<Coordinate | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!enabled || !focused || !foreground) return;
    let disposed = false;
    let subscription: LocationSubscription | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let stale: ReturnType<typeof setInterval> | undefined;
    let lastFix = 0;
    setLoading(true);
    setError("");
    setPosition(null);
    const fail = (message: string) => {
      if (!disposed) {
        setError(message);
        setLoading(false);
      }
    };
    (async () => {
      await locationService.requestPermission();
      if (disposed) return;
      timeout = setTimeout(
        () =>
          fail(
            "No se obtuvo una posición precisa a tiempo. Puedes elegir el origen en el mapa.",
          ),
        15000,
      );
      const watcher = await locationService.watch((point) => {
        if (disposed) return;
        if (!point) {
          setError("Señal GPS imprecisa. Esperando una posición fiable.");
          return;
        }
        lastFix = Date.now();
        clearTimeout(timeout);
        setPosition(point);
        setLoading(false);
        setError("");
      });
      if (disposed) {
        watcher.remove();
        return;
      }
      subscription = watcher;
      stale = setInterval(() => {
        if (lastFix && Date.now() - lastFix > 30000) {
          setPosition(null);
          setError(
            "Se perdió la señal GPS. Puedes seleccionar un origen manual.",
          );
        }
      }, 5000);
    })().catch((e: unknown) =>
      fail(e instanceof Error ? e.message : "No se pudo acceder al GPS."),
    );
    return () => {
      disposed = true;
      subscription?.remove();
      clearTimeout(timeout);
      clearInterval(stale);
    };
  }, [enabled, attempt, focused, foreground]);
  const request = useCallback(() => {
    setEnabled(true);
    setAttempt((value) => value + 1);
  }, []);
  return {
    position: focused && foreground ? position : null,
    error,
    loading: focused && foreground && loading,
    request,
  };
}
