import {
  coordinate,
  normalizeDestinations,
  ApiError,
} from "../_shared/domain.ts";
import { serve, fetchJson, geoapifyUrl } from "../_shared/http.ts";

serve("search", async (body) => {
  if (
    typeof body.text !== "string" ||
    body.text.trim().length < 3 ||
    body.text.length > 200
  )
    throw new ApiError(400, "Escribe entre 3 y 200 caracteres.");
  const url = geoapifyUrl("geocode/autocomplete");
  url.searchParams.set("text", body.text.trim());
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "es");
  url.searchParams.set("format", "geojson");
  if (body.proximity != null) {
    const p = coordinate(body.proximity);
    url.searchParams.set("bias", `proximity:${p.longitude},${p.latitude}`);
  }
  return {
    destinations: normalizeDestinations(await fetchJson(url.toString())),
  };
});
