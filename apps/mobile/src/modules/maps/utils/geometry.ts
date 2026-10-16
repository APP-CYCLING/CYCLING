import type {
  Bounds,
  Coordinate,
  Position,
  RouteGeometry,
} from "@cycling/contracts";

export const toPosition = (p: Coordinate): Position => [
  p.longitude,
  p.latitude,
];
export function validCoordinate(p: Coordinate): boolean {
  return (
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
export function geometryPoints(geometry?: RouteGeometry): Position[] {
  return !geometry
    ? []
    : geometry.type === "LineString"
      ? geometry.coordinates
      : geometry.coordinates.flat();
}
export function boundsOf(points: Position[]): Bounds | null {
  if (!points.length) return null;
  let west = 180,
    south = 90,
    east = -180,
    north = -90;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return [west, south, east, north];
}
export function areaKey(bounds: Bounds): string {
  return bounds
    .map((n, index) =>
      (index < 2 ? Math.floor(n / 0.02) : Math.ceil(n / 0.02)).toString(),
    )
    .join(":");
}
