import { useEffect, useState } from "react";
import type { Coordinate, Destination } from "@cycling/contracts";
import { plannerService } from "../services/planner.service";

export function useDestinationSearch(
  text: string,
  proximity: Coordinate | null,
  enabled: boolean,
) {
  const [suggestions, setSuggestions] = useState<Destination[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  // La proximidad mejora la búsqueda, pero no dispara consultas por cada fix GPS.
  const lat = proximity ? Math.round(proximity.latitude * 100) / 100 : null,
    lon = proximity ? Math.round(proximity.longitude * 100) / 100 : null;
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setSuggestions([]);
    setError("");
    setLoading(false);
    if (!enabled || text.trim().length < 3) return () => controller.abort();
    const timer = setTimeout(() => {
      setLoading(true);
      plannerService
        .search(
          text,
          lat != null && lon != null ? { latitude: lat, longitude: lon } : null,
          controller.signal,
        )
        .then((data) => {
          if (current) setSuggestions(data);
        })
        .catch((e: unknown) => {
          if (current && !controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "No se pudo buscar el destino.",
            );
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 550);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [text, lat, lon, enabled]);
  return { suggestions, loading, error };
}
