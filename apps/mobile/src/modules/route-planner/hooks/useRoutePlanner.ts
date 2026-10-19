import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Coordinate,
  Destination,
  PlannedRoute,
  RouteAlternatives,
  RouteMode,
  RouteOptionState,
} from "@cycling/contracts";
import { plannerService } from "../services/planner.service";
const states = (
  status: RouteOptionState["status"],
): Record<RouteMode, RouteOptionState> => ({
  fast: { status },
  cycleway_priority: { status },
  balanced: { status },
});
export function useRoutePlanner(origin: Coordinate | null) {
  const [destination, setDestination] = useState<Destination | null>(null);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [alternatives, setAlternatives] = useState<RouteAlternatives | null>(
    null,
  );
  const [routeOrigin, setRouteOrigin] = useState<Coordinate | null>(null);
  const [selectedRouteMode, setSelectedRouteMode] = useState<RouteMode>("fast");
  const [optionStates, setOptionStates] = useState(states("unavailable"));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null),
    generation = useRef(0);
  const running = useRef(false);
  const selected = useRef<RouteMode>("fast"),
    currentRoute = useRef<PlannedRoute | null>(null);
  const cancel = useCallback(() => {
    generation.current++;
    request.current?.abort();
    running.current = false;
    currentRoute.current = null;
    selected.current = "fast";
    setRoute(null);
    setAlternatives(null);
    setRouteOrigin(null);
    setSelectedRouteMode("fast");
    setOptionStates(states("unavailable"));
    setOptionsOpen(false);
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
  const calculate = useCallback(async () => {
    if (running.current) return;
    if (!origin || !destination) {
      setError("Selecciona un origen y un destino.");
      return;
    }
    const from = { ...origin },
      to = { ...destination.coordinate };
    cancel();
    running.current = true;
    const id = generation.current,
      controller = new AbortController();
    request.current = controller;
    const valid = () => id === generation.current && !controller.signal.aborted;
    setRouteOrigin(from);
    setLoading(true);
    setOptionsOpen(true);
    setOptionStates(states("loading"));
    try {
      const value = await plannerService.fast(from, to, controller.signal);
      if (!valid()) return;
      const {
        calculationId,
        alternativesError,
        alternatives: unused,
        ...raw
      } = value;
      const fast: PlannedRoute = {
        ...raw,
        mode: "fast",
        ...(calculationId &&
        raw.elevationStatus &&
        raw.elevationStatus !== "ready"
          ? { elevationStatus: "loading" as const }
          : {}),
      };
      currentRoute.current = fast;
      setRoute(fast);
      setAlternatives({
        options: [{ id: "fast", modes: ["fast"], route: fast }],
        unavailable: {},
        recommendedId: null,
        messages: [],
      });
      setOptionStates({
        fast: { status: "ready" },
        cycleway_priority: { status: "loading" },
        balanced: { status: "loading" },
      });
      if (!calculationId) {
        const message =
          alternativesError ||
          "Las otras opciones no est\u00e1n disponibles en este c\u00e1lculo.";
        setOptionStates({
          fast: { status: "ready" },
          cycleway_priority: { status: "unavailable", message },
          balanced: { status: "unavailable", message },
        });
        return;
      }
      const completed = await plannerService.complete(
        from,
        to,
        calculationId,
        controller.signal,
      );
      if (!valid()) return;
      const result = completed.alternatives;
      if (!result)
        throw new Error(
          "No se recibieron las alternativas. Puedes iniciar la Ruta R\u00e1pida o recalcular.",
        );
      setAlternatives(result);
      const nextStates = states("unavailable");
      for (const mode of [
        "fast",
        "cycleway_priority",
        "balanced",
      ] as RouteMode[]) {
        nextStates[mode] = result.options.some((option) =>
          option.modes.includes(mode),
        )
          ? { status: "ready" }
          : {
              status: "unavailable",
              message:
                result.unavailable[mode] ||
                "No hay una alternativa disponible para este recorrido.",
            };
      }
      setOptionStates(nextStates);
      // A late recommendation must never replace the user's explicit selection.
      const option =
        result.options.find((option) =>
          option.modes.includes(selected.current),
        ) ||
        result.options.find((option) => option.modes.includes("fast")) ||
        result.options[0];
      if (option) {
        const mode = option.modes.includes(selected.current)
          ? selected.current
          : option.modes[0];
        selected.current = mode;
        setSelectedRouteMode(mode);
        const next = {
          ...option.route,
          mode,
          // Preserve the geometry reference when only enrichment has changed.
          ...(JSON.stringify(currentRoute.current?.geometry) ===
          JSON.stringify(option.route.geometry)
            ? { geometry: currentRoute.current!.geometry }
            : {}),
        };
        if (
          currentRoute.current?.mode !== mode ||
          JSON.stringify(currentRoute.current.geometry) !==
            JSON.stringify(next.geometry) ||
          JSON.stringify(currentRoute.current.elevationProfile) !==
            JSON.stringify(next.elevationProfile) ||
          currentRoute.current.elevationStatus !== next.elevationStatus ||
          currentRoute.current.elevationGainMeters !==
            next.elevationGainMeters ||
          currentRoute.current.elevationLossMeters !==
            next.elevationLossMeters ||
          currentRoute.current.minElevationMeters !== next.minElevationMeters ||
          currentRoute.current.maxElevationMeters !== next.maxElevationMeters ||
          currentRoute.current.elevationSource !== next.elevationSource ||
          currentRoute.current.elevationError !== next.elevationError
        ) {
          currentRoute.current = next;
          setRoute(next);
        }
        if (!result.options.some((option) => option.modes.includes("fast")))
          setError(
            "La Ruta R\u00e1pida no est\u00e1 disponible. Se muestra otra alternativa calculada.",
          );
      } else {
        currentRoute.current = null;
        setRoute(null);
        setError("No se encontraron rutas disponibles.");
      }
    } catch (e: unknown) {
      if (!valid()) return;
      const message =
        e instanceof Error ? e.message : "No se pudo calcular la ruta.";
      setError(message);
      if (currentRoute.current?.elevationStatus === "loading") {
        const failed = {
          ...currentRoute.current,
          elevationStatus: "error" as const,
          elevationError:
            "No se pudo completar la elevación. La ruta sigue disponible.",
        };
        currentRoute.current = failed;
        setRoute(failed);
        setAlternatives((value) =>
          value
            ? {
                ...value,
                options: value.options.map((option) => ({
                  ...option,
                  route: option.modes.includes("fast") ? failed : option.route,
                })),
              }
            : value,
        );
      }
      setOptionStates(
        currentRoute.current
          ? {
              fast: { status: "ready" },
              cycleway_priority: { status: "error", message },
              balanced: { status: "error", message },
            }
          : {
              fast: { status: "error", message },
              cycleway_priority: {
                status: "unavailable",
                message: "No se pudo obtener una ruta base.",
              },
              balanced: {
                status: "unavailable",
                message: "No se pudo obtener una ruta base.",
              },
            },
      );
      if (!currentRoute.current) setRouteOrigin(null);
    } finally {
      if (valid()) {
        running.current = false;
        setLoading(false);
      }
    }
  }, [origin, destination, cancel]);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  const selectAlternative = (id: string) => {
    const option = alternatives?.options.find(
      (option) => option.id === id || option.modes.includes(id as RouteMode),
    );
    if (!option) return;
    const mode = option.modes.includes(id as RouteMode)
      ? (id as RouteMode)
      : option.modes[0];
    selected.current = mode;
    setSelectedRouteMode(mode);
    const next = { ...option.route, mode };
    currentRoute.current = next;
    setRoute(next);
  };
  return {
    destination,
    route,
    alternatives,
    routeOrigin,
    selectedRouteMode,
    optionStates,
    optionsOpen,
    openOptions: () => setOptionsOpen(true),
    closeOptions: () => setOptionsOpen(false),
    loading,
    error,
    select,
    calculate,
    cancel,
    selectAlternative,
  };
}
