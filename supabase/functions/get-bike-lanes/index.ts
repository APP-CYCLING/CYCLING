import { boundedArea, normalizeLanes, ApiError } from "../_shared/domain.ts";
import { serve, fetchJson } from "../_shared/http.ts";

const pending = new Map<string, Promise<ReturnType<typeof normalizeLanes>>>();

serve("lanes", async (body, admin) => {
  const [west, south, east, north] = boundedArea(body.bounds);
  const floor = (n: number) => Math.floor(n / 0.02) * 0.02,
    ceil = (n: number) => Math.ceil(n / 0.02) * 0.02;
  const area = [floor(west), floor(south), ceil(east), ceil(north)].map((n) =>
    Number(n.toFixed(2)),
  );
  const key = "lanes-v2:" + area.join(",");
  const cached = await admin
    .from("osm_cycleway_cache")
    .select("geojson")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached.error)
    throw new ApiError(503, "La caché geográfica no está disponible.");
  if (cached.data) return cached.data.geojson;
  const previous = pending.get(key);
  if (previous) return previous;
  const request = (async () => {
    const box = `${area[1]},${area[0]},${area[3]},${area[2]}`;
    const query = `[out:json][timeout:15];(way[highway=cycleway](${box});way[~"^cycleway(:left|:right|:both)?(:lane)?$"~"^(track|lane|opposite_track|opposite_lane|shared_lane|share_busway|opposite_share_busway|separate|advisory)$"](${box});way[bicycle~"^(designated|yes)$"](${box}););out tags geom;`;
    // Solo este host, nunca una URL suministrada por el cliente.
    const raw = await fetchJson(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "cycling/0.2 (bounded cycleway queries)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      },
      20000,
    );
    const collection = normalizeLanes(raw);
    const result = await admin.from("osm_cycleway_cache").upsert({
      cache_key: key,
      geojson: collection,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    if (result.error)
      throw new ApiError(503, "No se pudo actualizar la caché geográfica.");
    return collection;
  })();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
});
