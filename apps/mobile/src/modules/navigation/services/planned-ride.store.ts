import { useSyncExternalStore } from "react";
import type { Coordinate, Destination, PlannedRoute } from "@cycling/contracts";
type PlannedRide = {
  route: PlannedRoute;
  origin: Coordinate;
  destination: Destination;
  userId: string;
};
let active: PlannedRide | null = null;
const listeners = new Set<() => void>();
export function setPlannedRide(value: PlannedRide | null) {
  active = value;
  for (const listener of listeners) listener();
}
export function usePlannedRide(userId?: string) {
  const value = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => active,
    () => null,
  );
  return value?.userId === userId ? value : null;
}
