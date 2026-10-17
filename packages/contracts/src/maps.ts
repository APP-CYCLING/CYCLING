export type Coordinate = { latitude: number; longitude: number };
export type Position = [number, number];
export type Bounds = [number, number, number, number]; // west, south, east, north
export type RouteGeometry =
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] };
export type PlannedRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  steps?: NavigationStep[];
};
export type NavigationStep = {
  legIndex: number;
  fromIndex: number;
  toIndex: number;
  instruction: string;
  maneuver: string;
  streetName: string | null;
};
export type Destination = { id: string; label: string; coordinate: Coordinate };
export type LaneKind = "cycleway" | "track" | "lane" | "shared" | "designated";
export type LaneFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "LineString"; coordinates: Position[] };
  properties: { name: string; kind: LaneKind; tags: Record<string, string> };
};
export type LaneCollection = {
  type: "FeatureCollection";
  features: LaneFeature[];
};
