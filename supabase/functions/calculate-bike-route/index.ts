import { coordinate, normalizeRoute, ApiError } from "../_shared/domain.ts";
import { serve, fetchJson, geoapifyUrl } from "../_shared/http.ts";
import { corridor, buildOptions } from "../_shared/route-options.ts";
import { corridorNetwork } from "../_shared/corridor-network.ts";
import { cachedCalculation } from "../_shared/route-calculation.ts";
import type { Json } from "../_shared/database.ts";
import { enrichElevation } from "../_shared/elevation-service.ts";

serve("route", async (body, admin, userId) => {
  if (
    body.mode !== undefined &&
    !["fast", "cycleway_priority", "balanced"].includes(String(body.mode))
  )
    throw new ApiError(400, "Modalidad de ruta inválida.");
  const origin = coordinate(body.origin),
    destination = coordinate(body.destination);
  if (
    origin.latitude === destination.latitude &&
    origin.longitude === destination.longitude
  )
    throw new ApiError(400, "Elige un destino diferente al origen.");
  let fast: ReturnType<typeof normalizeRoute>;
  if (body.calculationId !== undefined) {
    if (
      typeof body.calculationId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.calculationId)
    )
      throw new ApiError(400, "Identificador de cálculo inválido.");
    const cached = await admin
      .from("osm_cycleway_cache")
      .select("geojson")
      .eq("cache_key", `route-job-v1:${body.calculationId}`)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached.error || !cached.data)
      throw new ApiError(409, "El cálculo expiró. Vuelve a calcular la ruta.");
    fast = cachedCalculation(cached.data.geojson, userId, origin, destination);
  } else {
    const url = geoapifyUrl("routing");
    url.searchParams.set(
      "waypoints",
      `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
    );
    url.searchParams.set("mode", "bicycle");
    url.searchParams.set("units", "metric");
    url.searchParams.set("lang", "es");
    url.searchParams.set(
      "details",
      "instruction_details,route_details,elevation",
    );
    fast = normalizeRoute(await fetchJson(url.toString()));
  }
  if (body.phase === "fast") {
    if (fast.elevationStatus === "ready")
      fast = await enrichElevation(fast, admin, userId);
    const calculationId = crypto.randomUUID();
    const saved = await admin.from("osm_cycleway_cache").upsert({
      cache_key: `route-job-v1:${calculationId}`,
      geojson: {
        version: 1,
        userId,
        origin,
        destination,
        route: fast,
      } as unknown as Json,
      expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
    });
    return {
      ...buildOptions(fast, null).options[0].route,
      ...(saved.error
        ? {
            alternativesError:
              "La ruta rápida está lista, pero no se pudieron preparar las otras opciones. Recalcula para reintentar.",
          }
        : { calculationId }),
    };
  }
  if (body.alternatives !== true)
    return await enrichElevation(fast, admin, userId);
  let alternatives;
  try {
    const bounds = corridor(fast);
    alternatives = bounds
      ? buildOptions(fast, await corridorNetwork(bounds, admin, userId))
      : buildOptions(
          fast,
          null,
          "Este recorrido excede el corredor soportado por el motor OSM acotado.",
        );
  } catch (error) {
    // The validated provider route remains usable when the optional network fails.
    alternatives = buildOptions(
      fast,
      null,
      error instanceof Error
        ? error.message
        : "No se pudo consultar la red OSM.",
    );
  }
  // Each distinct option is enriched from its own immutable geometry.
  // No provider routing request is used to obtain heights for OSM paths.
  alternatives.options = await Promise.all(
    alternatives.options.map(async (option) => ({
      ...option,
      route: await enrichElevation(option.route, admin, userId),
    })),
  );
  const mode = body.mode;
  const selected =
    mode && mode !== "fast"
      ? alternatives.options.find((option) =>
          option.modes.includes(mode as "balanced" | "cycleway_priority"),
        )
      : alternatives.options[0];
  if (!selected)
    throw new ApiError(
      503,
      "La modalidad elegida no está disponible para este recálculo. Conserva tu ruta o elige otra alternativa.",
    );
  return { ...selected.route, alternatives };
});
