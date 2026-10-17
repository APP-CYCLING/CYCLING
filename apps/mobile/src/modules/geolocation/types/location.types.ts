import type { Coordinate } from "@cycling/contracts";

export type LocationFix = {
  coordinate: Coordinate;
  accuracy: number | null;
  timestamp: number;
};
export type LocationState = {
  fix: LocationFix | null;
  loading: boolean;
  error: string;
  status:
    | "idle"
    | "loading"
    | "ready"
    | "approximate"
    | "denied"
    | "disabled"
    | "timeout"
    | "stale"
    | "error";
};
export type LocationReading = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};
export type LocationProvider = {
  permission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  servicesEnabled: () => Promise<boolean>;
  lastKnown: () => Promise<LocationReading | null>;
  current: () => Promise<LocationReading>;
  watch: (
    onFix: (reading: LocationReading) => void,
    onError: () => void,
  ) => Promise<{ remove: () => void }>;
};
