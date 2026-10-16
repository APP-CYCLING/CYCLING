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
): "cycleway" | "track" | "lane" | "shared" | "designated" | null {
  if (
    ["no", "private"].includes(tags.access) ||
    tags.bicycle === "no" ||
    ["construction", "proposed"].includes(tags.highway)
  )
    return null;
  if (tags.highway === "cycleway")
    return tags.segregated === "no" ? "shared" : "cycleway";
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
    const coordinates = way.geometry.map((p: unknown) => {
      const node = record(p);
      return position([node.lon, node.lat]);
    });
    return [
      {
        type: "Feature" as const,
        id: `osm-way-${way.id}`,
        geometry: { type: "LineString" as const, coordinates },
        properties: {
          name: tags.name ?? "Infraestructura ciclista sin nombre",
          kind,
          tags,
        },
      },
    ];
  });
  return { type: "FeatureCollection" as const, features };
}
