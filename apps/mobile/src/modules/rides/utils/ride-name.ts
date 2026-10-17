import type { Ride } from "@cycling/contracts";
export function automaticRideName(
  destinationName: string | null | undefined,
  endedAt: string,
): string {
  const date = new Date(endedAt);
  if (!Number.isFinite(date.getTime()))
    throw new Error("No se pudo determinar la fecha del recorrido.");
  const hour = date.getHours();
  const period =
    hour < 6
      ? "Madrugada"
      : hour < 12
        ? "Mañana"
        : hour < 19
          ? "Tarde"
          : "Noche";
  const stamp = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  const suffix = ` · ${stamp} · ${period}`;
  // Evitar cortar un emoji entre sus dos unidades UTF-16.
  const destination = (destinationName?.trim() || "Recorrido libre")
    .slice(0, 160 - suffix.length)
    .replace(/[\uD800-\uDBFF]$/, "");
  return `${destination}${suffix}`;
}
export function savedRideName(
  input: string,
  destinationName: string | null | undefined,
  endedAt: string,
) {
  const trimmed = input.trim();
  if (trimmed.length > 160)
    throw new Error("El nombre del recorrido no puede superar 160 caracteres.");
  return trimmed || automaticRideName(destinationName, endedAt);
}
export function rideDisplayName(
  ride: Pick<Ride, "title" | "destinationName" | "endedAt">,
) {
  return (
    ride.title?.trim() || automaticRideName(ride.destinationName, ride.endedAt)
  );
}
