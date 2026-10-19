import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { MapDatabase, Json } from "./database.ts";
import { fetchJson } from "./http.ts";
import type { OSMElement } from "./cycling-graph.ts";

const pending = new Map<string, Promise<OSMElement[]>>();
/** Cache and Overpass are server-only. No new tables or client privileges. */
export async function corridorNetwork(
  bounds: [number, number, number, number],
  admin: SupabaseClient<MapDatabase>,
  userId: string,
) {
  // Quantize outward: stable geographic cache cells, never cut off the corridor.
  const area = bounds.map(
    (n, i) => (i < 2 ? Math.floor(n / 0.002) : Math.ceil(n / 0.002)) * 0.002,
  );
  const key = `routing-network-v1:${area.map((n) => n.toFixed(3)).join(",")}`;
  const hit = await admin
    .from("osm_cycleway_cache")
    .select("geojson")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (hit.error)
    throw new Error("La caché de red ciclista no está disponible.");
  if (hit.data)
    return (hit.data.geojson as unknown as { elements: OSMElement[] }).elements;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const quota = await admin.rpc("consume_map_quota", {
      p_action: "lanes",
      p_user_id: userId,
    });
    if (quota.error || quota.data !== true)
      throw new Error(
        "Se alcanzó el límite de consultas OSM. La ruta rápida sigue disponible; reintenta las alternativas más tarde.",
      );
    const box = `${area[1]},${area[0]},${area[3]},${area[2]}`;
    const query = `[out:json][timeout:15];way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|steps)$"](${box})->.roads;.roads out body geom;rel(bw.roads)[type=restriction];out body;node(w.roads)[barrier];out body;node(w.roads)[bicycle=no];out body;node(w.roads)[access~"^(no|private)$"];out body;node(w.roads)[vehicle=no];out body;`;
    const data = (await fetchJson(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "cycling/0.3 bounded-routing",
        },
        body: new URLSearchParams({ data: query }).toString(),
      },
      18000,
    )) as { remark?: string; elements?: OSMElement[] };
    if (
      data.remark ||
      !Array.isArray(data.elements) ||
      data.elements.length > 12000
    )
      throw new Error(
        "OSM no pudo completar la red del corredor dentro de los límites de cálculo.",
      );
    const cached = {
      version: 1,
      source: "OpenStreetMap",
      updatedAt: new Date().toISOString(),
      bounds: area,
      elements: data.elements,
    };
    const saved = await admin
      .from("osm_cycleway_cache")
      .upsert({
        cache_key: key,
        geojson: cached as unknown as Json,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    if (saved.error) throw new Error("No se pudo conservar la red en caché.");
    return data.elements;
  })();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
