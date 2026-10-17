import type {
  BikeLane,
  CyclingRoute,
  Ride,
  LatLng,
  PlannedRoute,
} from "@cycling/contracts";
type AnyRow = Record<string, any>;
export function asCoordinate(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const p = value as LatLng;
  return Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
    ? { latitude: p.latitude, longitude: p.longitude }
    : null;
}
export function asPlannedRoute(value: unknown): PlannedRoute | null {
  if (!value || typeof value !== "object") return null;
  const route = value as PlannedRoute,
    g = route.geometry;
  if (
    !Number.isFinite(route.distanceMeters) ||
    route.distanceMeters <= 0 ||
    !Number.isFinite(route.durationSeconds) ||
    route.durationSeconds < 0 ||
    !g
  )
    return null;
  const lines =
    g.type === "LineString"
      ? [g.coordinates]
      : g.type === "MultiLineString"
        ? g.coordinates
        : null;
  if (
    !Array.isArray(lines) ||
    !lines.length ||
    !lines.every(
      (line) =>
        Array.isArray(line) &&
        line.length >= 2 &&
        line.every(
          (p) =>
            Array.isArray(p) &&
            !!asCoordinate({ longitude: p[0], latitude: p[1] }),
        ),
    )
  )
    return null;
  return route;
}
export function asPoints(value: unknown): LatLng[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as { type?: string; coordinates?: unknown };
  if (obj.type !== "LineString" || !Array.isArray(obj.coordinates)) return [];
  return obj.coordinates
    .filter(
      (p): p is [number, number] =>
        Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number",
    )
    .map(([longitude, latitude]) => ({ longitude, latitude }));
}
export function routeFromRow(r: AnyRow): CyclingRoute {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    distanceKm: Number(r.distance_km),
    difficulty: r.difficulty,
    durationMin: r.duration_min,
    ascentM: r.ascent_m,
    coordinates: asPoints(r.path_geojson),
    isDemo: r.is_demo,
  };
}
export function laneFromRow(r: AnyRow): BikeLane {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    coordinates: asPoints(r.path_geojson),
    isDemo: r.is_demo,
  };
}
export function rideFromRow(r: AnyRow): Ride {
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : null,
    destinationName:
      typeof r.destination_name === "string" ? r.destination_name : null,
    routeId: r.route_id,
    distanceKm: Number(r.distance_km),
    durationSec: r.duration_sec,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    coordinates: asPoints(r.path_geojson),
    plannedRoute: asPlannedRoute(r.planned_route),
    destination: asCoordinate(r.destination),
    stopPosition:
      asCoordinate(r.stop_position) ?? asPoints(r.path_geojson).at(-1) ?? null,
    completionStatus: ["completed", "incomplete", "unplanned"].includes(
      r.completion_status,
    )
      ? r.completion_status
      : "unknown",
  };
}
export function pointsToGeoJSON(points: LatLng[]) {
  return {
    type: "LineString" as const,
    coordinates: points.map((p) => [p.longitude, p.latitude]),
  };
}
