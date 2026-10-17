import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinate, Destination, PlannedRoute } from "@cycling/contracts";
import { plannerService } from "../services/planner.service";

export function useRoutePlanner(origin: Coordinate | null) {
  const [destination, setDestination] = useState<Destination | null>(null),
    [route, setRoute] = useState<PlannedRoute | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [routeOrigin, setRouteOrigin] = useState<Coordinate | null>(null);
  const request = useRef<AbortController | null>(null),
    generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current++;
    request.current?.abort();
    setRoute(null);
    setRouteOrigin(null);
    setLoading(false);
    setError("");
  }, []);
  const select = useCallback(
    (next: Destination | null) => {
      cancel();
      setDestination(next);
    },
    [cancel],
  );
  // El GPS puede moverse: el origen de una ruta confirmada es una instantánea,
  // y no se recalcula por actualizaciones de posición ni cámara.
  const calculate = useCallback(async () => {
    if (!origin || !destination) {
      setError("Selecciona un origen y un destino.");
      return;
    }
    cancel();
    const id = generation.current;
    const controller = new AbortController();
    setRouteOrigin({ ...origin });
    request.current = controller;
    setLoading(true);
    try {
      const value = await plannerService.calculate(
        origin,
        destination.coordinate,
        controller.signal,
      );
      if (id === generation.current && !controller.signal.aborted)
        setRoute(value);
    } catch (e: unknown) {
      if (id === generation.current && !controller.signal.aborted) {
        setRouteOrigin(null);
        setError(
          e instanceof Error ? e.message : "No se pudo calcular la ruta.",
        );
      }
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [origin, destination, cancel]);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  return {
    destination,
    route,
    routeOrigin,
    loading,
    error,
    select,
    calculate,
    cancel,
  };
}
