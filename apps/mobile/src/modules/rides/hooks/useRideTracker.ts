import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@cycling/contracts";
import type { LocationFix } from "../../geolocation/types/location.types";
import { canRecordFix } from "../../geolocation/utils/location-policy";

function distance(a: LatLng, b: LatLng) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
type Recording = {
  startedMs: number;
  endedMs: number | null;
  points: LatLng[];
  km: number;
  lastFixMs: number;
};

/** Consume los mismos fixes que el mapa; nunca abre un segundo watcher GPS. */
export function useRideTracker(fix: LocationFix | null, focused: boolean) {
  const [active, setActive] = useState(false),
    [points, setPoints] = useState<LatLng[]>([]),
    [km, setKm] = useState(0),
    [seconds, setSeconds] = useState(0),
    [started, setStarted] = useState<string | null>(null),
    [error, setError] = useState("");
  const recording = useRef<Recording | null>(null),
    running = useRef(false);
  const stop = useCallback(() => {
    running.current = false;
    setActive(false);
    const value = recording.current;
    if (value && value.endedMs === null) value.endedMs = Date.now();
    const durationSec = value
      ? Math.floor(((value.endedMs ?? Date.now()) - value.startedMs) / 1000)
      : 0;
    setSeconds(durationSec);
    return {
      durationSec,
      endedAt: new Date(value?.endedMs ?? Date.now()).toISOString(),
      startedAt: value ? new Date(value.startedMs).toISOString() : null,
      distanceKm: value?.km ?? 0,
      coordinates: value ? [...value.points] : [],
    };
  }, []);
  useEffect(() => {
    if (!focused) stop();
  }, [focused, stop]);
  useEffect(
    () => () => {
      running.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const value = recording.current;
      if (value && running.current)
        setSeconds(Math.floor((Date.now() - value.startedMs) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    const value = recording.current;
    if (
      !running.current ||
      !value ||
      !canRecordFix(fix) ||
      fix.timestamp <= value.lastFixMs
    )
      return;
    const previous = value.points.at(-1),
      next = fix.coordinate;
    const delta = previous ? distance(previous, next) : 0;
    if (delta > 0.2) {
      setError(
        "Se detectó un salto de GPS. Ese tramo no se está sumando a tu recorrido.",
      );
      return;
    }
    value.lastFixMs = fix.timestamp;
    value.km += delta;
    value.points = [...value.points.slice(-9999), next];
    setPoints(value.points);
    setKm(value.km);
    setError("");
  }, [fix]);
  const start = () => {
    if (running.current) return false;
    if (!focused || !canRecordFix(fix)) {
      setError(
        "Espera una ubicación GPS reciente y precisa antes de iniciar el recorrido. Activa «Ubicación precisa» o pulsa Reintentar ubicación.",
      );
      return false;
    }
    const now = Date.now();
    recording.current = {
      startedMs: now,
      endedMs: null,
      points: [fix.coordinate],
      km: 0,
      lastFixMs: fix.timestamp,
    };
    running.current = true;
    setPoints([fix.coordinate]);
    setKm(0);
    setSeconds(0);
    setStarted(new Date(now).toISOString());
    setError("");
    setActive(true);
    return true;
  };
  return { active, points, km, seconds, started, error, start, stop };
}
