import { useEffect, useRef, useState } from "react";
import type { Bounds, LaneCollection } from "@cycling/contracts";
import { osmLanesService } from "../services/osm-lanes.service";
import { areaKey } from "../../maps/utils/geometry";

const empty: LaneCollection = { type: "FeatureCollection", features: [] };
export function useVisibleBikeLanes(bounds: Bounds | null, enabled: boolean) {
  const [data, setData] = useState<LaneCollection>(empty),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const lastRequest = useRef(0),
    viewport = useRef(bounds);
  viewport.current = bounds;
  const valid =
    bounds &&
    bounds[0] < bounds[2] &&
    bounds[1] < bounds[3] &&
    bounds[2] - bounds[0] <= 0.12 &&
    bounds[3] - bounds[1] <= 0.12;
  const key = valid && bounds ? areaKey(bounds) : null;
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setError("");
    setData(empty);
    setLoading(false);
    if (!enabled || !key) {
      if (enabled)
        setError("Acerca el mapa para ver infraestructura ciclista.");
      return () => {
        current = false;
        controller.abort();
      };
    }
    const timer = setTimeout(
      () => {
        const area = viewport.current;
        if (!area) return;
        lastRequest.current = Date.now();
        setLoading(true);
        osmLanesService
          .list(area, controller.signal)
          .then((value) => {
            if (current) setData(value);
          })
          .catch((e: unknown) => {
            if (current && !controller.signal.aborted)
              setError(
                e instanceof Error
                  ? e.message
                  : "No se pudieron cargar las ciclovías.",
              );
          })
          .finally(() => {
            if (current) setLoading(false);
          });
      },
      Math.max(1000, 11000 - (Date.now() - lastRequest.current)),
    );
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, enabled]);
  return { data: enabled ? data : empty, loading, error };
}
