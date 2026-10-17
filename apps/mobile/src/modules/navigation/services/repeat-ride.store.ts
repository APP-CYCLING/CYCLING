import { useSyncExternalStore } from "react";
import type { Destination } from "@cycling/contracts";
let request: { destination: Destination; userId: string } | null = null;
const listeners = new Set<() => void>();
export function setRepeatRide(value: typeof request) {
  request = value;
  listeners.forEach((listener) => listener());
}
export function useRepeatRide(userId?: string) {
  const value = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => request,
    () => null,
  );
  return value?.userId === userId ? value : null;
}
