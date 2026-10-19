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
  mode?: RouteMode;
  coverage?: RouteCoverage;
  durationSource?: "geoapify" | "cycling_model";
  alternatives?: RouteAlternatives;
} & Partial<RouteElevation>;
export type ElevationProfilePoint = {
  distanceMeters: number;
  elevationMeters: number | null;
  segmentIndex: number;
};
export type RouteElevation = {
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  elevationProfile: ElevationProfilePoint[];
  elevationSource: "geoapify" | "maptiler" | null;
  elevationStatus: "loading" | "ready" | "partial" | "error";
  elevationError?: string;
  elevationMethod?: string;
  elevationSampleSpacingMeters?: number;
};
export type RouteMode = "fast" | "cycleway_priority" | "balanced";
export type RouteCalculation = PlannedRoute & {
  calculationId?: string;
  alternativesError?: string;
};
export type RouteOptionState = {
  status: "loading" | "ready" | "unavailable" | "error";
  message?: string;
};
export type RouteCoverage = {
  percent: number | null;
  segregatedMeters: number | null;
  laneMeters: number | null;
  status: "unavailable" | "estimated" | "osm_topology";
  transitions: number | null;
};
export type RouteOption = {
  id: string;
  modes: RouteMode[];
  route: PlannedRoute;
};
export type RouteAlternatives = {
  options: RouteOption[];
  unavailable: Partial<Record<RouteMode, string>>;
  recommendedId: string | null;
  messages: string[];
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
export type LaneKind =
  "cycleway" | "track" | "lane" | "shared" | "designated" | "unknown";
export type LaneFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "LineString"; coordinates: Position[] };
  properties: {
    name: string;
    kind: LaneKind;
    tags: Record<string, string>;
    infrastructure?: "segregated" | "lane" | "shared" | "unknown";
    osmWayId?: string;
    side?: string;
    geometryBasis?: "independent" | "attribute" | "visual_offset";
    updatedAt?: string;
    source?: string;
    validation?: string;
  };
};
export type LaneCollection = {
  type: "FeatureCollection";
  features: LaneFeature[];
};
