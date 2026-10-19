// Method version is part of every cache key. Distances and heights are meters.
export const ELEVATION_METHOD = "dem-v1-50m-100-median3-deadband2";
export const ELEVATION_POLICY = {
  spacing: 50,
  maxPoints: 100,
  deadband: 2,
  maxLength: 100000,
};
type Position = [number, number];
export type Geometry = { type: string; coordinates: Position[] | Position[][] };
export type ProfilePoint = {
  distanceMeters: number;
  elevationMeters: number | null;
  segmentIndex: number;
};
export type ElevationData = {
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  elevationProfile: ProfilePoint[];
  elevationSource: "geoapify" | "maptiler" | null;
  elevationStatus: "ready" | "partial" | "error";
  elevationError?: string;
  elevationMethod: string;
  elevationSampleSpacingMeters?: number;
};
const validHeight = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= -12000 && v <= 10000;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
export function noElevation(message: string): ElevationData {
  return {
    elevationGainMeters: null,
    elevationLossMeters: null,
    minElevationMeters: null,
    maxElevationMeters: null,
    elevationProfile: [],
    elevationSource: null,
    elevationStatus: "error",
    elevationError: message,
    elevationMethod: ELEVATION_METHOD,
  };
}
export function distance(a: Position, b: Position) {
  const r = Math.PI / 180,
    dlat = (b[1] - a[1]) * r,
    dlon = (b[0] - a[0]) * r;
  return (
    12742000 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dlat / 2) ** 2 +
            Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dlon / 2) ** 2,
        ),
      ),
    )
  );
}
export function geometryLines(geometry: Geometry): Position[][] {
  return geometry.type === "LineString"
    ? [geometry.coordinates as Position[]]
    : (geometry.coordinates as Position[][]);
}
// Keep endpoints of each leg; never connect disjoint MultiLineString parts.
export function sampleGeometry(geometry: Geometry) {
  const lines = geometryLines(geometry);
  if (
    !lines.length ||
    lines.length > 20 ||
    lines.some((line) => line.length < 2)
  )
    throw new Error("Geometría insuficiente para elevación.");
  const lengths = lines.map((line) =>
    line.slice(1).reduce((sum, p, i) => sum + distance(line[i], p), 0),
  );
  const total = lengths.reduce((a, b) => a + b, 0);
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    total > ELEVATION_POLICY.maxLength
  )
    throw new Error(
      "Perfil no disponible para recorridos de más de 100 km o geometría inválida.",
    );
  const spacing = Math.max(
    ELEVATION_POLICY.spacing,
    total / (ELEVATION_POLICY.maxPoints - 2 * lines.length),
  );
  const samples: (ProfilePoint & { coordinate: Position })[] = [];
  let offset = 0;
  lines.forEach((line, segmentIndex) => {
    const cumulative = [0];
    for (let i = 1; i < line.length; i++)
      cumulative.push(cumulative[i - 1] + distance(line[i - 1], line[i]));
    const length = lengths[segmentIndex],
      n = Math.max(1, Math.ceil(length / spacing));
    let edge = 1;
    for (let i = 0; i <= n; i++) {
      const at = (length * i) / n;
      while (edge < cumulative.length - 1 && cumulative[edge] < at) edge++;
      const span = cumulative[edge] - cumulative[edge - 1],
        t = span ? (at - cumulative[edge - 1]) / span : 0;
      const a = line[edge - 1],
        b = line[edge];
      samples.push({
        coordinate: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        distanceMeters: offset + at,
        elevationMeters: null,
        segmentIndex,
      });
    }
    offset += length;
  });
  if (samples.length > ELEVATION_POLICY.maxPoints)
    throw new Error("El perfil supera el límite de muestras.");
  return { samples, spacing };
}
export function summarizeElevation(
  raw: ProfilePoint[],
  source: "geoapify" | "maptiler",
  spacing: number,
): ElevationData {
  if (raw.length < 2)
    return noElevation("El proveedor no devolvió un perfil válido.");
  // A median of 3 suppresses isolated DEM spikes. Never filter across gaps/legs.
  const profile = raw.map((p, i) => {
    const values = [raw[i - 1], p, raw[i + 1]];
    const smooth =
      i > 0 &&
      i < raw.length - 1 &&
      values.every(
        (v) =>
          v.segmentIndex === p.segmentIndex && validHeight(v.elevationMeters),
      );
    const height = smooth
      ? values.map((v) => v.elevationMeters as number).sort((a, b) => a - b)[1]
      : p.elevationMeters;
    return { ...p, elevationMeters: validHeight(height) ? height : null };
  });
  const heights = profile.flatMap((p) =>
    p.elevationMeters === null ? [] : [p.elevationMeters],
  );
  const complete = heights.length === profile.length;
  if (!heights.length)
    return noElevation("El proveedor no devolvió altitudes válidas.");
  let gain = 0,
    loss = 0,
    anchor: ProfilePoint | null = null;
  for (const p of profile) {
    if (p.elevationMeters === null) {
      anchor = null;
      continue;
    }
    if (!anchor || anchor.segmentIndex !== p.segmentIndex) {
      anchor = p;
      continue;
    }
    const delta = p.elevationMeters - anchor.elevationMeters!;
    if (Math.abs(delta) >= ELEVATION_POLICY.deadband) {
      if (delta > 0) gain += delta;
      else loss -= delta;
      anchor = p;
    }
  }
  return {
    elevationGainMeters: complete ? gain : null,
    elevationLossMeters: complete ? loss : null,
    minElevationMeters: Math.min(...heights),
    maxElevationMeters: Math.max(...heights),
    elevationProfile: profile,
    elevationSource: source,
    elevationStatus: complete ? "ready" : "partial",
    ...(!complete
      ? {
          elevationError:
            "Perfil parcial: faltan altitudes; D+ y D− no están disponibles.",
        }
      : {}),
    elevationMethod: ELEVATION_METHOD,
    elevationSampleSpacingMeters: spacing,
  };
}
export function geoapifyElevation(
  properties: unknown,
  geometry: Geometry,
): ElevationData {
  const legs = object(properties).legs,
    lines = geometryLines(geometry);
  if (!Array.isArray(legs) || legs.length !== lines.length || legs.length > 20)
    return noElevation("Geoapify no devolvió elevación para esta ruta.");
  const profile: ProfilePoint[] = [];
  const total = legs.reduce((sum, raw, i) => {
    const leg = object(raw),
      range = leg.elevation_range;
    const length =
      Array.isArray(range) && Array.isArray(range.at(-1))
        ? range.at(-1)[0]
        : lines[i]
            .slice(1)
            .reduce((s, p, j) => s + distance(lines[i][j], p), 0);
    return sum + (typeof length === "number" ? length : NaN);
  }, 0);
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    total > ELEVATION_POLICY.maxLength
  )
    return noElevation("Perfil fuera de los límites de elevación soportados.");
  let offset = 0;
  const spacing = Math.max(
    ELEVATION_POLICY.spacing,
    total / (ELEVATION_POLICY.maxPoints - 2 * legs.length),
  );
  for (let segmentIndex = 0; segmentIndex < legs.length; segmentIndex++) {
    const leg = object(legs[segmentIndex]),
      range = leg.elevation_range;
    let points: [number, number | null][] = [];
    if (Array.isArray(range) && range.length >= 2 && range.length <= 100000) {
      points = range.map((v) =>
        Array.isArray(v) && typeof v[0] === "number" && Number.isFinite(v[0])
          ? [v[0], validHeight(v[1]) ? v[1] : null]
          : [NaN, null],
      );
    } else if (
      Array.isArray(leg.elevation) &&
      leg.elevation.length === lines[segmentIndex].length
    ) {
      let at = 0;
      points = lines[segmentIndex].map((p, i) => {
        if (i) at += distance(lines[segmentIndex][i - 1], p);
        return [
          at,
          validHeight((leg.elevation as unknown[])[i])
            ? (leg.elevation as number[])[i]
            : null,
        ];
      });
    }
    if (
      points.length < 2 ||
      points[0][0] !== 0 ||
      points.some(
        (p, i) =>
          !Number.isFinite(p[0]) ||
          p[0] < 0 ||
          (i > 0 && p[0] < points[i - 1][0]),
      )
    )
      return noElevation("El perfil de Geoapify no es válido.");
    const length = points.at(-1)![0];
    if (
      length <= 0 ||
      (typeof leg.distance === "number" &&
        Math.abs(leg.distance - length) > Math.max(20, leg.distance * 0.05))
    )
      return noElevation("El perfil de Geoapify está incompleto.");
    const count = Math.max(1, Math.ceil(length / spacing));
    let edge = 1;
    for (let i = 0; i <= count; i++) {
      const at = (length * i) / count;
      while (edge < points.length - 1 && points[edge][0] < at) edge++;
      const [a, ha] = points[edge - 1],
        [b, hb] = points[edge];
      // Missing measurements are gaps, never zero or interpolated through.
      const h =
        at === a
          ? ha
          : at === b
            ? hb
            : ha === null || hb === null
              ? null
              : ha + ((hb - ha) * (at - a)) / (b - a || 1);
      profile.push({
        distanceMeters: offset + at,
        elevationMeters: h,
        segmentIndex,
      });
    }
    // A gap must remain visible even if it falls between the uniform samples.
    for (const [at, h] of points)
      if (h === null) {
        const start = profile.length - count - 1,
          index = start + Math.min(count, Math.round((at / length) * count));
        profile[index].elevationMeters = null;
      }
    offset += length;
  }
  return summarizeElevation(profile, "geoapify", spacing);
}
