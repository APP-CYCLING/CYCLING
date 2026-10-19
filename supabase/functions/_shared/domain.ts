import { geoapifyElevation } from "./elevation.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Formato de datos inválido.");
  return value as Record<string, unknown>;
}
export function coordinate(value: unknown): {
  latitude: number;
  longitude: number;
} {
  const v = record(value);
  if (
    typeof v.latitude !== "number" ||
    !Number.isFinite(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    typeof v.longitude !== "number" ||
    !Number.isFinite(v.longitude) ||
    Math.abs(v.longitude) > 180
  ) {
    throw new ApiError(400, "Coordenadas fuera de rango.");
  }
  return { latitude: v.latitude, longitude: v.longitude };
}
function position(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length < 2)
    throw new ApiError(502, "Geometría del proveedor inválida.");
  try {
    const p = coordinate({ longitude: value[0], latitude: value[1] });
    return [p.longitude, p.latitude];
  } catch {
    throw new ApiError(502, "Coordenadas del proveedor inválidas.");
  }
}
function line(value: unknown): [number, number][] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 100000)
    throw new ApiError(502, "Recorrido del proveedor inválido.");
  return value.map(position);
}
export function normalizeRoute(value: unknown) {
  const data = record(value);
  if (!Array.isArray(data.features) || !data.features.length)
    throw new ApiError(
      404,
      "No se encontró una ruta para bicicleta entre estos puntos.",
    );
  const feature = record(data.features[0]),
    props = record(feature.properties),
    geometry = record(feature.geometry);
  const distance = props.distance,
    duration = props.time;
  if (
    typeof distance !== "number" ||
    !Number.isFinite(distance) ||
    distance < 0 ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration < 0
  )
    throw new ApiError(
      502,
      "El proveedor no devolvió distancia y duración válidas.",
    );
  let normalized:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "MultiLineString"; coordinates: [number, number][][] };
  if (geometry.type === "LineString")
    normalized = {
      type: "LineString",
      coordinates: line(geometry.coordinates),
    };
  else if (
    geometry.type === "MultiLineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0 &&
    geometry.coordinates.length <= 100
  ) {
    // No unir segmentos separados: hacerlo inventaría un tramo recto entre ellos.
    normalized = {
      type: "MultiLineString",
      coordinates: geometry.coordinates.map(line),
    };
  } else throw new ApiError(502, "Tipo de geometría no admitido.");
  return {
    distanceMeters: distance,
    durationSeconds: duration,
    geometry: normalized,
    steps: normalizeSteps(props.legs, normalized),
    ...geoapifyElevation(props, normalized),
  };
}
function normalizeSteps(
  legs: unknown,
  geometry: {
    type: string;
    coordinates: [number, number][] | [number, number][][];
  },
) {
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates as [number, number][]]
      : (geometry.coordinates as [number, number][][]);
  if (!Array.isArray(legs) || legs.length !== lines.length) return [];
  return legs.flatMap((raw: unknown, legIndex: number) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      !("steps" in raw) ||
      !Array.isArray(raw.steps)
    )
      return [];
    const steps = raw.steps.slice(0, 10000);
    let previous = -1;
    return steps.flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const step = value as Record<string, unknown>;
      const from = step.from_index,
        to = step.to_index;
      if (
        typeof from !== "number" ||
        typeof to !== "number" ||
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < previous ||
        from < 0 ||
        to < from ||
        to >= lines[legIndex].length
      )
        return [];
      previous = from;
      const instruction =
        step.instruction && typeof step.instruction === "object"
          ? (step.instruction as Record<string, unknown>)
          : {};
      const streets = Array.isArray(instruction.streets)
        ? instruction.streets
            .filter((name): name is string => typeof name === "string")
            .join(", ")
        : null;
      return [
        {
          legIndex,
          fromIndex: from,
          toIndex: to,
          instruction:
            typeof instruction.text === "string"
              ? instruction.text.slice(0, 600)
              : "",
          maneuver:
            typeof instruction.type === "string"
              ? instruction.type.slice(0, 60)
              : "None",
          streetName:
            typeof step.name === "string"
              ? step.name.slice(0, 200)
              : streets?.slice(0, 200) || null,
        },
      ];
    });
  });
}
export function normalizeStreet(value: unknown) {
  const data = record(value);
  if (!Array.isArray(data.features) || !data.features.length)
    return { street: null, locality: null };
  const properties = record(record(data.features[0]).properties);
  return {
    street:
      typeof properties.street === "string"
        ? properties.street.slice(0, 200)
        : null,
    locality:
      typeof properties.city === "string"
        ? properties.city.slice(0, 200)
        : null,
  };
}
export function normalizeDestinations(value: unknown) {
  const data = record(value);
  if (!Array.isArray(data.features))
    throw new ApiError(502, "Respuesta de búsqueda inválida.");
  return data.features.slice(0, 5).map((item: unknown) => {
    const feature = record(item),
      props = record(feature.properties),
      geom = record(feature.geometry);
    if (geom.type !== "Point" || typeof props.formatted !== "string")
      throw new ApiError(502, "Destino inválido.");
    const [longitude, latitude] = position(geom.coordinates);
    return {
      id: String(props.place_id ?? `${longitude},${latitude}`),
      label: props.formatted,
      coordinate: { latitude, longitude },
    };
  });
}
export function boundedArea(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4)
    throw new ApiError(400, "Área de consulta inválida.");
  const [w, s, e, n] = value as unknown[];
  coordinate({ longitude: w, latitude: s });
  coordinate({ longitude: e, latitude: n });
  const west = w as number,
    south = s as number,
    east = e as number,
    north = n as number;
  if (
    west >= east ||
    south >= north ||
    east - west > 0.12 ||
    north - south > 0.12
  )
    throw new ApiError(400, "Acerca el mapa para consultar las ciclovías.");
  return [west, south, east, north];
}
export function classifyLane(
  tags: Record<string, string>,
): "cycleway" | "track" | "lane" | "shared" | "designated" | "unknown" | null {
  if (
    ["no", "private"].includes(tags.access) ||
    tags.bicycle === "no" ||
    ["construction", "proposed"].includes(tags.highway)
  )
    return null;
  if (tags.highway === "cycleway")
    return tags.segregated === "no" ? "shared" : "cycleway";
  if (
    ["path", "footway"].includes(tags.highway) &&
    tags.bicycle === "designated"
  )
    return tags.segregated === "yes" ? "cycleway" : "shared";
  const values = [
    "cycleway",
    "cycleway:left",
    "cycleway:right",
    "cycleway:both",
  ].map((key) => tags[key]);
  if (values.some((v) => ["track", "opposite_track"].includes(v)))
    return "track";
  if (values.some((v) => ["lane", "opposite_lane"].includes(v))) return "lane";
  if (
    values.some((v) =>
      ["shared_lane", "share_busway", "opposite_share_busway"].includes(v),
    )
  )
    return "shared";
  if (tags.bicycle === "designated") return "designated";
  if (tags.bicycle === "yes") return "shared";
  if (
    Object.keys(tags).some(
      (key) =>
        key.startsWith("cycleway") && !["no", "none"].includes(tags[key]),
    )
  )
    return "unknown";
  return null;
}
export function normalizeLanes(value: unknown) {
  const data = record(value);
  if (typeof data.remark === "string")
    throw new ApiError(
      503,
      "OpenStreetMap no pudo completar la consulta. Inténtalo más tarde.",
    );
  if (!Array.isArray(data.elements) || data.elements.length > 5000)
    throw new ApiError(
      502,
      "Respuesta de ciclovías demasiado grande o inválida.",
    );
  const seen = new Set<string>();
  const features = data.elements.flatMap((item: unknown) => {
    const way = record(item);
    if (
      way.type !== "way" ||
      !Array.isArray(way.geometry) ||
      way.geometry.length < 2
    )
      return [];
    const raw = record(way.tags ?? {}),
      tags: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw))
      if (typeof val === "string") tags[key] = val;
    const kind = classifyLane(tags);
    if (!kind) return [];
    if (seen.has(String(way.id))) return [];
    seen.add(String(way.id));
    const coordinates = way.geometry.map((p: unknown) => {
      const node = record(p);
      return position([node.lon, node.lat]);
    });
    const independent =
      tags.highway === "cycleway" || ["path", "footway"].includes(tags.highway);
    const sides = independent
      ? ["center"]
      : tags["cycleway:both"] &&
          !["no", "none", "separate"].includes(tags["cycleway:both"])
        ? ["left", "right"]
        : ["left", "right"].filter(
            (side) =>
              tags[`cycleway:${side}`] &&
              !["no", "none", "separate"].includes(tags[`cycleway:${side}`]),
          );
    return (sides.length ? sides : ["center"]).map((side) => {
      const sideTags =
        side === "center"
          ? tags
          : {
              ...tags,
              cycleway: tags[`cycleway:${side}`] || tags["cycleway:both"],
            };
      if (side !== "center")
        for (const field of [
          "cycleway:left",
          "cycleway:right",
          "cycleway:both",
        ])
          delete sideTags[field];
      const laneKind = classifyLane(sideTags) || kind;
      const advisory =
        tags[`cycleway:${side}:lane`] === "advisory" ||
        tags["cycleway:lane"] === "advisory" ||
        tags["cycleway:both:lane"] === "advisory";
      const infrastructure = advisory
        ? "shared"
        : ["cycleway", "track"].includes(laneKind)
          ? "segregated"
          : laneKind === "lane"
            ? "lane"
            : laneKind === "shared"
              ? "shared"
              : "unknown";
      return {
        type: "Feature" as const,
        id: `osm-way-${way.id}-${side}`,
        geometry: { type: "LineString" as const, coordinates },
        properties: {
          name: tags.name ?? "Infraestructura ciclista sin nombre",
          kind: laneKind,
          infrastructure,
          tags,
          osmWayId: String(way.id),
          side,
          geometryBasis: independent
            ? "independent"
            : side === "center"
              ? "attribute"
              : "visual_offset",
          source: "OpenStreetMap",
          validation: "unverified",
          updatedAt: new Date().toISOString(),
        },
      };
    });
  });
  return { type: "FeatureCollection" as const, features };
}
