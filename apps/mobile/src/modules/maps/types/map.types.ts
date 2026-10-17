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
  stopPosition?: Coordinate | null;
  stopLabel?: string;
  minimumSpan?: number;
  followLocation?: boolean;
  navigationMode?: boolean;
  navigationTopInset?: number;
  navigationBearing?: number;
  onFollowChange?: (follow: boolean) => void;
  geometry?: RouteGeometry;
  infrastructure?: LaneCollection;
  centerRequest?: number;
  fitRequest?: number;
  initialFocus?: "location" | "route";
  onPick?: (point: Coordinate) => void;
  onBoundsChange?: (bounds: Bounds) => void;
  onLanePress?: (feature: LaneFeature) => void;
};
