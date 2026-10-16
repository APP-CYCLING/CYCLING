import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import type { LatLng } from "@cycling/contracts";
function distance(a: LatLng, b: LatLng) {
  const R = 6371;
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function useRideTracker() {
  const [active, setActive] = useState(false),
    [points, setPoints] = useState<LatLng[]>([]),
    [km, setKm] = useState(0),
    [seconds, setSeconds] = useState(0),
    [started, setStarted] = useState<string | null>(null),
    [error, setError] = useState("");
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const startedAt = useRef<number | null>(null);
  const last = useRef<LatLng | null>(null);
  const generation = useRef(0),
    starting = useRef(false),
    endedAt = useRef<number | null>(null);
  const release = useCallback(() => {
    generation.current++;
    starting.current = false;
    watcher.current?.remove();
    watcher.current = null;
    setActive(false);
    if (startedAt.current && !endedAt.current) endedAt.current = Date.now();
    const durationSec = startedAt.current
      ? Math.floor(((endedAt.current ?? Date.now()) - startedAt.current) / 1000)
      : 0;
    setSeconds(durationSec);
    return {
      durationSec,
      endedAt: new Date(endedAt.current ?? Date.now()).toISOString(),
    };
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        release();
      },
      [release],
    ),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" && watcher.current) release();
    });
    return () => listener.remove();
  }, [release]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (startedAt.current)
        setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => () => watcher.current?.remove(), []);
  const start = async () => {
    if (watcher.current || starting.current) return;
    starting.current = true;
    const id = ++generation.current;
    setError("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (id !== generation.current) return;
      if (perm.status !== "granted") {
        setError("Se necesita permiso de ubicación");
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        if (id === generation.current)
          setError("Activa el GPS para registrar el recorrido.");
        return;
      }
      if (id !== generation.current) return;
      if (AppState.currentState !== "active") {
        setError("Mantén la app en primer plano para iniciar el GPS.");
        return;
      }
      setPoints([]);
      setKm(0);
      setSeconds(0);
      last.current = null;
      endedAt.current = null;
      startedAt.current = Date.now();
      setStarted(new Date().toISOString());
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 8,
          timeInterval: 3000,
        },
        (p) => {
          if (
            id !== generation.current ||
            p.coords.accuracy == null ||
            p.coords.accuracy > 70
          )
            return;
          const next = {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          };
          if (
            !Number.isFinite(next.latitude) ||
            !Number.isFinite(next.longitude) ||
            Math.abs(next.latitude) > 90 ||
            Math.abs(next.longitude) > 180
          )
            return;
          if (last.current) {
            const delta = distance(last.current, next);
            if (delta > 0.2) return;
            setKm((k) => k + delta);
          }
          last.current = next;
          setPoints((prev) => [...prev.slice(-9999), next]);
        },
      );
      if (id !== generation.current || AppState.currentState !== "active") {
        subscription.remove();
        return;
      }
      watcher.current = subscription;
      setActive(true);
    } catch (e: unknown) {
      if (id === generation.current)
        setError(e instanceof Error ? e.message : "Error GPS");
    } finally {
      if (id === generation.current) starting.current = false;
    }
  };
  const stop = release;
  return { active, points, km, seconds, started, error, start, stop };
}
