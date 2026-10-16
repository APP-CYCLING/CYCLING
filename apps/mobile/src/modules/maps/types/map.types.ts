import type {
  BikeLane,
  CyclingRoute,
  LatLng,
  Coordinate,
  Bounds,
  LaneCollection,
  LaneFeature,
  RouteGeometry,
} from "@cycling/contracts";
export type CyclingMapProps = {
  height?: number;
  fill?: boolean;
  routes?: CyclingRoute[];
  lanes?: BikeLane[];
  tracked?: LatLng[];
  showUser?: boolean;
  currentLocation?: Coordinate | null;
  origin?: Coordinate | null;
  destination?: Coordinate | null;
  geometry?: RouteGeometry;
  infrastructure?: LaneCollection;
  centerRequest?: number;
  fitRequest?: number;
  onPick?: (point: Coordinate) => void;
  onBoundsChange?: (bounds: Bounds) => void;
  onLanePress?: (feature: LaneFeature) => void;
};
