import { useEffect, useMemo, useRef, useState } from "react";
import type { Coordinate, PlannedRoute } from "@cycling/contracts";
import type { LocationFix } from "../../geolocation/types/location.types";
import { canRecordFix } from "../../geolocation/utils/location-policy";
import { useVisibleBikeLanes } from "../../bike-lanes/hooks/useVisibleBikeLanes";
import { plannerService } from "../../route-planner/services/planner.service";
import { callMapFunction } from "../../../shared/services/map-functions";
import {
  announce,
  stopAnnouncements,
} from "../services/navigation-audio.service";
import {
  bearing,
  buildNavigation,
  locateOnRoute,
  meters,
  nearestCycleway,
} from "../utils/live-navigation";
type Plan = {
  route: PlannedRoute;
  destination: { coordinate: Coordinate; label: string };
} | null;
export function useLiveNavigation(
  plan: Plan,
  fix: LocationFix | null,
  enabled: boolean,
  userId?: string,
) {
  const [voice, setVoice] = useState(false),
    [follow, setFollow] = useState(true);
  const [override, setOverride] = useState<{
    source: Plan;
    route: PlannedRoute;
  } | null>(null);
  const [recalculating, setRecalculating] = useState(false),
    [error, setError] = useState("");
  const [street, setStreet] = useState<{
    name: string | null;
    coordinate: Coordinate;
    at: number;
  } | null>(null);
  const [streetError, setStreetError] = useState("");
  const route = override?.source === plan ? override.route : plan?.route;
  const model = useMemo(() => (route ? buildNavigation(route) : null), [route]);
  const state = useRef<{
    model: typeof model;
    progress: number | null;
    last: LocationFix | null;
    heading: number;
    offCount: number;
  }>({ model: null, progress: null, last: null, heading: 0, offCount: 0 });
  const precise = canRecordFix(fix) && fix.accuracy! <= 35;
  const progress = useMemo(() => {
    if (state.current.model !== model)
      state.current = {
        model,
        progress: null,
        last: null,
        heading: 0,
        offCount: 0,
      };
    if (!fix || !canRecordFix(fix) || fix.accuracy! > 35) return null;
    const previous = state.current.last;
    const movement = previous ? meters(previous.coordinate, fix.coordinate) : 0;
    // Ignore teleporting fixes, which must not trigger a turn or arrival.
    if (previous && (fix.timestamp <= previous.timestamp || movement > 150)) {
      if (fix.timestamp === previous.timestamp)
        return model
          ? locateOnRoute(model, fix.coordinate, state.current.progress)
          : null;
      state.current.last = fix;
      return null;
    }
    if (previous && movement >= 4)
      state.current.heading = bearing(previous.coordinate, fix.coordinate);
    state.current.last = fix;
    const hit = model
      ? locateOnRoute(model, fix.coordinate, state.current.progress, movement)
      : null;
    if (hit && hit.distance <= 35 && !hit.backtracking) {
      state.current.progress = hit.progress;
      state.current.offCount = 0;
    } else if (hit) state.current.offCount++;
    return hit;
  }, [model, fix]);
  const onRoute =
    !!progress && progress.distance <= 35 && !progress.backtracking;
  const offRoute = precise && state.current.offCount >= 3;
  const arrived =
    precise &&
    onRoute &&
    !!model &&
    progress!.remaining <= 25 &&
    !!plan &&
    meters(fix!.coordinate, plan.destination.coordinate) <= 35;
  const ready = enabled && precise && (!route || onRoute);
  const laneBounds = useMemo<[number, number, number, number] | null>(() => {
    if (!fix) return null;
    const { longitude: x, latitude: y } = fix.coordinate;
    return [
      Math.max(-180, x - 0.005),
      Math.max(-90, y - 0.005),
      Math.min(180, x + 0.005),
      Math.min(90, y + 0.005),
    ];
  }, [fix?.coordinate.latitude, fix?.coordinate.longitude]);
  const lanes = useVisibleBikeLanes(laneBounds, enabled && precise && !!userId);
  const lane =
    precise && fix ? nearestCycleway(fix.coordinate, lanes.data) : null;
  const currentStreet = onRoute ? progress?.currentStep?.streetName : null;
  const streetName =
    currentStreet ||
    (street?.name &&
    fix &&
    Date.now() - street.at < 120000 &&
    meters(fix.coordinate, street.coordinate) <= 80
      ? street.name
      : null);
  const reverse = useRef<{
    controller: AbortController | null;
    at: number;
    position: Coordinate | null;
  }>({ controller: null, at: 0, position: null });
  const mounted = useRef(false),
    routeRequest = useRef<AbortController | null>(null);
  const announced = useRef(new Set<string>());
  useEffect(() => {
    announced.current.clear();
  }, [route]);
  useEffect(() => {
    mounted.current = enabled;
    if (enabled) {
      setFollow(true);
      setRecalculating(false);
    }
    let keepAwake: typeof import("expo-keep-awake") | null = null,
      cancelled = false;
    if (enabled)
      void import("expo-keep-awake")
        .then(async (module) => {
          if (cancelled) return;
          keepAwake = module;
          await module.activateKeepAwakeAsync("cycling-navigation");
          if (cancelled)
            void module
              .deactivateKeepAwake("cycling-navigation")
              .catch(() => {});
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "No se pudo mantener la pantalla encendida. Revisa el bloqueo automático del teléfono.",
            );
        });
    return () => {
      cancelled = true;
      mounted.current = false;
      reverse.current.controller?.abort();
      reverse.current.controller = null;
      routeRequest.current?.abort();
      routeRequest.current = null;
      stopAnnouncements();
      if (keepAwake)
        void keepAwake
          .deactivateKeepAwake("cycling-navigation")
          .catch(() => {});
    };
  }, [enabled, userId]);
  useEffect(() => {
    if (
      !enabled ||
      !precise ||
      !userId ||
      !fix ||
      currentStreet ||
      reverse.current.controller
    )
      return;
    const now = Date.now(),
      previous = reverse.current;
    if (
      now - previous.at < 60000 ||
      (previous.position && meters(previous.position, fix.coordinate) < 60)
    )
      return;
    const controller = new AbortController();
    reverse.current = { controller, at: now, position: fix.coordinate };
    setStreetError("");
    void callMapFunction<{ street: string | null }>(
      "reverse-location",
      { coordinate: fix.coordinate },
      controller.signal,
    )
      .then((value) => {
        if (mounted.current && !controller.signal.aborted)
          setStreet({
            name: value.street,
            coordinate: fix.coordinate,
            at: now,
          });
      })
      .catch((e) => {
        if (mounted.current && !controller.signal.aborted)
          setStreetError(
            e instanceof Error ? e.message : "No se pudo identificar la calle.",
          );
      })
      .finally(() => {
        if (reverse.current.controller === controller)
          reverse.current.controller = null;
      });
  }, [enabled, precise, userId, fix, currentStreet]);
  const next = progress?.nextStep;
  const cueKey = arrived
    ? "arrived"
    : offRoute
      ? "off-route"
      : next
        ? `${next.legIndex}:${next.fromIndex}:${progress!.toManeuver <= 10 ? "turn" : progress!.toManeuver <= 40 ? "near" : progress!.toManeuver <= 150 ? "ahead" : "far"}`
        : !route && streetName
          ? `street:${streetName}`
          : "";
  useEffect(() => {
    if (
      !enabled ||
      !voice ||
      !precise ||
      !cueKey ||
      (!!route && !offRoute && !onRoute) ||
      (next && progress!.toManeuver > 150 && !arrived && !offRoute)
    ) {
      stopAnnouncements();
      return;
    }
    if (announced.current.has(cueKey)) return;
    announced.current.add(cueKey);
    const text = arrived
      ? "Has llegado al destino. Puedes finalizar y guardar tu recorrido."
      : offRoute
        ? "Te has alejado de la ruta. Puedes recalcular desde tu ubicación actual."
        : !route && streetName
          ? `Estás cerca de ${streetName}.`
          : `${progress!.toManeuver <= 5 ? "En el próximo cruce" : `En ${Math.round(progress!.toManeuver / 10) * 10} metros`}, ${next!.instruction}`;
    void announce(text).catch((e) => {
      if (mounted.current) setError(e.message);
    });
  }, [enabled, voice, precise, cueKey, onRoute, offRoute, arrived]);
  const recalculate = async () => {
    if (!plan || !precise || !fix || routeRequest.current) return;
    const controller = new AbortController();
    routeRequest.current = controller;
    setRecalculating(true);
    setError("");
    try {
      const nextRoute = await plannerService.calculate(
        fix.coordinate,
        plan.destination.coordinate,
        controller.signal,
        route?.mode,
      );
      if (mounted.current && !controller.signal.aborted)
        setOverride({ source: plan, route: nextRoute });
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "No se pudo recalcular la ruta.",
        );
    } finally {
      if (routeRequest.current === controller) routeRequest.current = null;
      if (mounted.current) setRecalculating(false);
    }
  };
  return {
    enabled,
    precise,
    ready,
    route,
    progress,
    arrived,
    offRoute,
    streetName,
    streetError,
    lane,
    lanes,
    heading: state.current.heading,
    follow,
    setFollow,
    voice,
    toggleVoice: () => {
      announced.current.clear();
      setVoice((value) => !value);
    },
    error,
    recalculating,
    recalculate,
    retryStreet: () => {
      reverse.current.at = 0;
      reverse.current.position = null;
      setStreetError("");
      setStreet(null);
    },
  };
}
