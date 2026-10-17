import { coordinate, normalizeRoute, ApiError } from "../_shared/domain.ts";
import { serve, fetchJson, geoapifyUrl } from "../_shared/http.ts";

serve("route", async (body) => {
  const origin = coordinate(body.origin),
    destination = coordinate(body.destination);
  if (
    origin.latitude === destination.latitude &&
    origin.longitude === destination.longitude
  )
    throw new ApiError(400, "Elige un destino diferente al origen.");
  const url = geoapifyUrl("routing");
  url.searchParams.set(
    "waypoints",
    `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
  );
  url.searchParams.set("mode", "bicycle");
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "es");
  url.searchParams.set("details", "instruction_details,route_details");
  return normalizeRoute(await fetchJson(url.toString()));
});
