import { coordinate, normalizeStreet } from "../_shared/domain.ts";
import { serve, fetchJson, geoapifyUrl } from "../_shared/http.ts";
// Reuses authenticated search quota; no public geocoder or database writes.
serve("search", async (body) => {
  const point = coordinate(body.coordinate);
  const url = geoapifyUrl("geocode/reverse");
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("lang", "es");
  url.searchParams.set("limit", "1");
  return normalizeStreet(await fetchJson(url.toString()));
});
