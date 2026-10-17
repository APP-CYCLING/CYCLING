import type { CreateRideInput, Ride } from "@cycling/contracts";
import { savedRideName } from "../utils/ride-name";
import { getSupabase } from "../../../shared/supabase/client";
import { rideFromRow, pointsToGeoJSON } from "../../../shared/supabase/mappers";
export const ridesService = {
  async list(): Promise<Ride[]> {
    const { data, error } = await getSupabase()
      .from("rides_private")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map(rideFromRow);
  },
  async create(input: CreateRideInput): Promise<{ id: string }> {
    const { data, error } = await getSupabase().rpc("save_planned_ride", {
      p_planned_route: input.plannedRoute ?? null,
      p_destination: input.destination ?? null,
      p_stop_position: input.stopPosition ?? input.coordinates.at(-1) ?? null,
      p_title: savedRideName(
        input.title ?? "",
        input.destinationName,
        input.endedAt,
      ),
      p_destination_name: input.destinationName?.trim().slice(0, 500) || null,
      p_route_id: input.routeId,
      p_distance_km: input.distanceKm,
      p_duration_sec: input.durationSec,
      p_started_at: input.startedAt,
      p_ended_at: input.endedAt,
      p_track:
        input.coordinates.length >= 2
          ? pointsToGeoJSON(input.coordinates)
          : null,
    });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883")
        throw new Error(
          "Falta aplicar la migración 202610160004_ride_details.sql (después de 202610160003_ride_names.sql) en Supabase. Tu recorrido sigue disponible para reintentar el guardado.",
        );
      throw error;
    }
    if (typeof data !== "string" || !data)
      throw new Error("No se pudo confirmar el guardado del recorrido.");
    return { id: data };
  },
};
