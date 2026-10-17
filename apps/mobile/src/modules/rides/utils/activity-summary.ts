import type { Ride } from "@cycling/contracts";
export type ActivityPeriod = "week" | "month" | "year" | "all";
export function startOfWeek(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
export function filterRides(
  rides: Ride[],
  period: ActivityPeriod,
  now = new Date(),
) {
  const start =
    period === "week"
      ? startOfWeek(now)
      : period === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : period === "year"
          ? new Date(now.getFullYear(), 0, 1)
          : new Date(0);
  return rides.filter((ride) => {
    const time = new Date(ride.startedAt).getTime();
    return (
      Number.isFinite(time) && time >= start.getTime() && time <= now.getTime()
    );
  });
}
export function summarizeRides(rides: Ride[]) {
  const distanceKm = rides.reduce((sum, ride) => sum + ride.distanceKm, 0),
    durationSec = rides.reduce((sum, ride) => sum + ride.durationSec, 0);
  return {
    distanceKm,
    durationSec,
    count: rides.length,
    averageKmh: durationSec > 0 ? (distanceKm * 3600) / durationSec : 0,
  };
}
export function dailyDistances(rides: Ride[], now = new Date()) {
  const start = startOfWeek(now);
  return ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
    (label, index) => {
      const from = new Date(start);
      from.setDate(from.getDate() + index);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return {
        label,
        distance: rides
          .filter((ride) => {
            const at = new Date(ride.startedAt);
            return at >= from && at < to && at <= now;
          })
          .reduce((sum, ride) => sum + ride.distanceKm, 0),
      };
    },
  );
}
export function rideDayLabel(iso: string, now = new Date()) {
  const date = new Date(iso),
    today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const prefix =
    date >= today
      ? "Hoy"
      : date >= yesterday
        ? "Ayer"
        : date.toLocaleDateString("es", { weekday: "long" });
  return `${prefix}, ${date.toLocaleDateString("es", { day: "numeric", month: "long" })}`;
}
export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} m`
    : `${minutes} min`;
}
