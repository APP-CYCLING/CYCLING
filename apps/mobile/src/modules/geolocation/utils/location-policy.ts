import type { LocationFix, LocationReading } from "../types/location.types";

export const MAX_FIX_AGE_MS = 30000;
export function toLocationFix(
  reading: LocationReading,
  now = Date.now(),
): LocationFix | null {
  const { latitude, longitude, accuracy } = reading.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(reading.timestamp) ||
    now - reading.timestamp > MAX_FIX_AGE_MS ||
    reading.timestamp > now + 5000 ||
    (accuracy != null &&
      (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 3000))
  )
    return null;
  return {
    coordinate: { latitude, longitude },
    accuracy,
    timestamp: reading.timestamp,
  };
}
export function isFreshFix(
  fix: LocationFix | null,
  now = Date.now(),
): fix is LocationFix {
  return (
    fix !== null &&
    now - fix.timestamp <= MAX_FIX_AGE_MS &&
    fix.timestamp <= now + 5000
  );
}
export function canRecordFix(
  fix: LocationFix | null,
  now = Date.now(),
): fix is LocationFix {
  return (
    isFreshFix(fix, now) &&
    now - fix.timestamp <= 10000 &&
    fix.accuracy !== null &&
    fix.accuracy <= 70
  );
}
