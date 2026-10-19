import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { MapDatabase, Json } from "./database.ts";
import { fetchJson } from "./http.ts";
import {
  ELEVATION_METHOD,
  noElevation,
  sampleGeometry,
  summarizeElevation,
  type Geometry,
  type ElevationData,
} from "./elevation.ts";

type Route = { geometry: Geometry } & Partial<ElevationData>;
const pending = new Map<string, Promise<ElevationData>>();
export async function elevationCacheKey(geometry: Geometry, source: string) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ method: ELEVATION_METHOD, source, geometry }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `elevation:${source}:${ELEVATION_METHOD}:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function enrichElevation<T extends Route>(
  route: T,
  admin: SupabaseClient<MapDatabase>,
  userId: string,
): Promise<T & ElevationData> {
  try {
    return await enrich(route, admin, userId);
  } catch {
    return {
      ...route,
      ...noElevation(
        "No se pudo completar la elevación. La ruta sigue disponible.",
      ),
    };
  }
}
async function enrich<T extends Route>(
  route: T,
  admin: SupabaseClient<MapDatabase>,
  userId: string,
): Promise<T & ElevationData> {
  // Provider profiles apply only to their own geometry; no reuse by proximity.
  const source =
    route.elevationStatus === "ready" && route.elevationSource === "geoapify"
      ? "geoapify"
      : "maptiler";
  const key = await elevationCacheKey(route.geometry, source);
  const cached = await admin
    .from("osm_cycleway_cache")
    .select("geojson")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!cached.error && cached.data) {
    const data = cached.data.geojson as unknown as ElevationData;
    if (data.elevationMethod === ELEVATION_METHOD)
      return { ...route, ...data, elevationError: data.elevationError };
  }
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      // Fail closed on cache errors: avoid unbounded paid requests on an outage.
      if (cached.error)
        return source === "geoapify"
          ? (route as T & ElevationData)
          : noElevation("La caché de elevación no está disponible.");
      if (source === "geoapify") return save(route as T & ElevationData);
      const apiKey = Deno.env.get("MAPTILER_ELEVATION_KEY");
      if (!apiKey)
        return noElevation("Elevación MapTiler no configurada en el servidor.");
      const lockKey = `${key}:lock`;
      // Existing private table supplies a cross-instance lease (no schema change).
      await admin
        .from("osm_cycleway_cache")
        .delete()
        .eq("cache_key", lockKey)
        .lt("expires_at", new Date().toISOString());
      const lease = await admin.from("osm_cycleway_cache").insert({
        cache_key: lockKey,
        geojson: { method: ELEVATION_METHOD },
        expires_at: new Date(Date.now() + 120000).toISOString(),
      });
      if (lease.error)
        return noElevation(
          "La elevación de este trazado ya se está procesando. Reintenta más tarde.",
        );
      try {
        const { samples, spacing } = sampleGeometry(route.geometry);
        for (let start = 0; start < samples.length; start += 50) {
          // Each batch <=50 points consumes a shared existing route quota slot.
          const quota = await admin.rpc("consume_map_quota", {
            p_action: "route",
            p_user_id: userId,
          });
          if (quota.error || quota.data !== true)
            throw new Error(
              "Cuota temporal de elevación alcanzada. La ruta sigue disponible.",
            );
          const batch = samples.slice(start, start + 50);
          if (
            batch.some(
              (p) =>
                Math.abs(p.coordinate[1]) > 85 ||
                Math.abs(p.coordinate[0]) >= 180,
            )
          )
            throw new Error(
              "MapTiler no cubre las coordenadas de este perfil.",
            );
          const url = new URL(
            `https://api.maptiler.com/elevation/${batch.map((p) => p.coordinate.join(",")).join(";")}.json`,
          );
          url.searchParams.set("key", apiKey);
          url.searchParams.set("unit", "meters");
          const result = await fetchJson(url.toString(), {}, 10000);
          if (!Array.isArray(result) || result.length !== batch.length)
            throw new Error("MapTiler devolvió un perfil incompleto.");
          result.forEach((v, i) => {
            if (
              !Array.isArray(v) ||
              v.length < 3 ||
              typeof v[0] !== "number" ||
              typeof v[1] !== "number" ||
              Math.abs(v[0] - batch[i].coordinate[0]) > 0.00001 ||
              Math.abs(v[1] - batch[i].coordinate[1]) > 0.00001
            )
              throw new Error(
                "MapTiler devolvió puntos fuera del trazado solicitado.",
              );
            batch[i].elevationMeters =
              typeof v[2] === "number" && Number.isFinite(v[2]) ? v[2] : null;
          });
        }
        return await save(
          summarizeElevation(
            samples.map(({ coordinate: _, ...point }) => point),
            "maptiler",
            spacing,
          ),
        );
      } catch {
        // Provider exceptions may contain URLs; never send them to the client.
        return await save(
          noElevation(
            "No se pudo obtener la elevación. La ruta sigue disponible.",
          ),
        );
      } finally {
        await admin
          .from("osm_cycleway_cache")
          .delete()
          .eq("cache_key", lockKey);
      }
    })();
    pending.set(key, task);
  }
  try {
    const data = await task;
    return { ...route, ...data, elevationError: data.elevationError };
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
  async function save(data: ElevationData): Promise<ElevationData> {
    // Store only elevation fields, not steps, routes, user IDs or API keys.
    const value: ElevationData = {
      elevationGainMeters: data.elevationGainMeters,
      elevationLossMeters: data.elevationLossMeters,
      minElevationMeters: data.minElevationMeters,
      maxElevationMeters: data.maxElevationMeters,
      elevationProfile: data.elevationProfile,
      elevationSource: data.elevationSource,
      elevationStatus: data.elevationStatus,
      elevationMethod: ELEVATION_METHOD,
      ...(data.elevationError ? { elevationError: data.elevationError } : {}),
      ...(data.elevationSampleSpacingMeters
        ? { elevationSampleSpacingMeters: data.elevationSampleSpacingMeters }
        : {}),
    };
    await admin.from("osm_cycleway_cache").upsert({
      cache_key: key,
      geojson: value as unknown as Json,
      expires_at: new Date(
        Date.now() + (data.elevationStatus === "ready" ? 7 * 86400000 : 300000),
      ).toISOString(),
    });
    return value;
  }
}
