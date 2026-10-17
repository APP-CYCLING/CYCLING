import type {
  Coordinate,
  LaneCollection,
  NavigationStep,
  PlannedRoute,
  Position,
} from "@cycling/contracts";
const R = 6371000,
  rad = (n: number) => (n * Math.PI) / 180;
export function meters(a: Coordinate, b: Coordinate) {
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
const point = ([longitude, latitude]: Position): Coordinate => ({
  longitude,
  latitude,
});
export function bearing(a: Coordinate, b: Coordinate) {
  const dl = rad(b.longitude - a.longitude),
    p = rad(a.latitude),
    q = rad(b.latitude);
  return (
    ((Math.atan2(
      Math.sin(dl) * Math.cos(q),
      Math.cos(p) * Math.sin(q) - Math.sin(p) * Math.cos(q) * Math.cos(dl),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
function project(p: Coordinate, a: Coordinate, b: Coordinate) {
  const x = Math.max(0.01, Math.cos(rad(p.latitude)));
  const dx = (b.longitude - a.longitude) * x,
    dy = b.latitude - a.latitude;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.longitude - a.longitude) * x * dx + (p.latitude - a.latitude) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
  const projected = {
    latitude: a.latitude + t * dy,
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };
  return { fraction: t, distance: meters(p, projected) };
}
type Segment = { a: Coordinate; b: Coordinate; from: number; to: number };
export type NavigationModel = {
  segments: Segment[];
  total: number;
  steps: (NavigationStep & { at: number; until: number })[];
};
export function buildNavigation(route: PlannedRoute): NavigationModel {
  const lines =
    route.geometry.type === "LineString"
      ? [route.geometry.coordinates]
      : route.geometry.coordinates;
  const segments: Segment[] = [],
    offsets: number[][] = [];
  let total = 0;
  lines.forEach((line) => {
    const distances = [total];
    for (let index = 1; index < line.length; index++) {
      const a = point(line[index - 1]),
        b = point(line[index]);
      const from = total;
      total += meters(a, b);
      if (total > from) segments.push({ a, b, from, to: total });
      distances.push(total);
    }
    // Each leg starts a new line: never add a straight connection across a gap.
    offsets.push(distances);
  });
  const steps = (Array.isArray(route.steps) ? route.steps : [])
    .flatMap((step) => {
      if (!step || typeof step !== "object") return [];
      const leg = offsets[step.legIndex];
      if (
        !leg ||
        !Number.isInteger(step.fromIndex) ||
        !Number.isInteger(step.toIndex) ||
        step.fromIndex < 0 ||
        step.toIndex < step.fromIndex ||
        step.toIndex >= leg.length ||
        typeof step.instruction !== "string" ||
        typeof step.maneuver !== "string"
      )
        return [];
      return [{ ...step, at: leg[step.fromIndex], until: leg[step.toIndex] }];
    })
    .sort((a, b) => a.at - b.at);
  return { segments, total, steps };
}
export function locateOnRoute(
  model: NavigationModel,
  position: Coordinate,
  previous: number | null,
  movement = 0,
) {
  const windowEnd =
    previous == null ? Infinity : previous + Math.max(90, movement * 2 + 40);
  const candidates = model.segments
    .filter(
      (s) => previous == null || (s.to >= previous - 40 && s.from <= windowEnd),
    )
    .map((s) => {
      const hit = project(position, s.a, s.b);
      return {
        distance: hit.distance,
        progress: s.from + (s.to - s.from) * hit.fraction,
      };
    });
  if (!candidates.length) return null;
  const nearest = candidates.reduce(
    (best, candidate) => Math.min(best, candidate.distance),
    Infinity,
  );
  // At crossings prefer the expected section, rather than jumping to the final lap.
  const close = candidates.filter((c) => c.distance <= nearest + 6);
  close.sort((a, b) =>
    previous == null
      ? a.progress - b.progress
      : Math.abs(a.progress - previous) - Math.abs(b.progress - previous),
  );
  const hit = close[0];
  const progress =
    previous == null ? hit.progress : Math.max(previous, hit.progress);
  const currentStep = [...model.steps]
    .reverse()
    .find((s) => s.at <= progress + 4 && s.until >= progress - 4);
  const nextStep = model.steps.find(
    (s) =>
      s.at > progress + 3 &&
      s.instruction &&
      !/^(None|StartAt.*)$/.test(s.maneuver),
  );
  return {
    progress,
    distance: hit.distance,
    backtracking: previous != null && hit.progress < previous - 35,
    currentStep,
    nextStep,
    remaining: Math.max(0, model.total - progress),
    toManeuver: nextStep
      ? Math.max(0, nextStep.at - progress)
      : Math.max(0, model.total - progress),
  };
}
export function nearestCycleway(position: Coordinate, lanes: LaneCollection) {
  let best: { name: string; kind: string; distance: number } | null = null;
  for (const lane of lanes.features) {
    const line = lane.geometry.coordinates;
    for (let i = 1; i < line.length; i++) {
      const distance = project(
        position,
        point(line[i - 1]),
        point(line[i]),
      ).distance;
      if (distance <= 20 && (!best || distance < best.distance))
        best = {
          name: lane.properties.name,
          kind: lane.properties.kind,
          distance,
        };
    }
  }
  return best;
}
export const distanceLabel = (distance: number) =>
  distance < 1000
    ? `${Math.max(0, Math.round(distance / 10) * 10)} m`
    : `${(distance / 1000).toFixed(1)} km`;
