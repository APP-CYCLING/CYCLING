import {
  attach,
  buildGraph,
  shortest,
  summarize,
  ROUTING_POLICY,
  meters,
  type Position,
  type OSMElement,
  type Mode,
} from "./cycling-graph.ts";

type Route = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: string; coordinates: Position[] | Position[][] };
  steps?: unknown[];
};
function points(route: Route): Position[] {
  return route.geometry.type === "LineString"
    ? (route.geometry.coordinates as Position[])
    : (route.geometry.coordinates as Position[][]).flat();
}
export function sameRoute(a: Route, b: Route) {
  if (
    Math.abs(a.distanceMeters - b.distanceMeters) >
    Math.max(a.distanceMeters, b.distanceMeters) *
      ROUTING_POLICY.minimumDistinctRatio
  )
    return false;
  const pa = points(a),
    pb = points(b);
  if (!pa.length || !pb.length) return false;
  const near = (p: Position, line: Position[]) => {
    const scale = Math.cos((p[1] * Math.PI) / 180);
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i],
        x = (b[0] - a[0]) * scale,
        y = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * scale * x + (p[1] - a[1]) * y) /
            (x * x + y * y || 1),
        ),
      );
      if (
        meters(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]) <= 0.75
      )
        return true;
    }
    return false;
  };
  const fraction = (line: Position[], other: Position[]) => {
    let all = 0,
      matched = 0;
    for (let i = 1; i < line.length; i++) {
      const length = meters(line[i - 1], line[i]);
      all += length;
      const middle: Position = [
        (line[i - 1][0] + line[i][0]) / 2,
        (line[i - 1][1] + line[i][1]) / 2,
      ];
      if (
        near(line[i - 1], other) &&
        near(middle, other) &&
        near(line[i], other)
      )
        matched += length;
    }
    return all ? matched / all : 0;
  };
  return fraction(pa, pb) >= 0.96 && fraction(pb, pa) >= 0.96;
}
export function corridor(
  route: Route,
): [number, number, number, number] | null {
  const p = points(route);
  if (
    !p.length ||
    p.length > 10000 ||
    (route.geometry.type !== "LineString" &&
      route.geometry.coordinates.length !== 1)
  )
    return null;
  const pad = 0.006,
    w = Math.min(...p.map((p) => p[0])) - pad,
    s = Math.min(...p.map((p) => p[1])) - pad,
    e = Math.max(...p.map((p) => p[0])) + pad,
    n = Math.max(...p.map((p) => p[1])) + pad;
  if (
    e - w > ROUTING_POLICY.maxSpanDegrees ||
    n - s > ROUTING_POLICY.maxSpanDegrees ||
    (e - w) * (n - s) > ROUTING_POLICY.maxAreaDegrees
  )
    return null;
  return [w, s, e, n];
}
const unknownCoverage = {
  percent: null,
  segregatedMeters: null,
  laneMeters: null,
  status: "unavailable",
  transitions: null,
};
export function buildOptions(
  fast: Route,
  elements: OSMElement[] | null,
  reason?: string,
) {
  const first = {
    ...fast,
    mode: "fast" as Mode,
    coverage: unknownCoverage,
    durationSource: "geoapify",
  };
  const options: {
    id: string;
    modes: Mode[];
    route: Route & Record<string, unknown>;
  }[] = [{ id: "fast", modes: ["fast"], route: first }];
  const unavailable: Partial<Record<Mode, string>> = {},
    messages: string[] = [];
  const fail = (message: string) => {
    unavailable.cycleway_priority = message;
    unavailable.balanced = message;
  };
  let recommendedId: string | null = null;
  if (!elements) fail(reason || "La red OSM del corredor no está disponible.");
  else {
    const graph = buildGraph(elements),
      p = points(fast);
    if (
      !attach(graph, p[0], "origin") ||
      !attach(graph, p.at(-1)!, "destination")
    )
      fail(
        "No se pudo vincular el origen y destino a una vía OSM sin ambigüedad. No se conectan calles por cercanía.",
      );
    else
      for (const mode of ["cycleway_priority", "balanced"] as Mode[]) {
        const path = shortest(graph, "origin", "destination", mode);
        if (!path?.length) {
          unavailable[mode] =
            "No hay un recorrido conectado con las restricciones soportadas en este corredor.";
          continue;
        }
        const route = { ...summarize(path), mode };
        if (
          route.distanceMeters >
            fast.distanceMeters * ROUTING_POLICY.maxDetour[mode] ||
          route.durationSeconds > Math.max(fast.durationSeconds * 2, 120)
        ) {
          unavailable[mode] =
            "La alternativa disponible exige un desvío excesivo.";
          continue;
        }
        if (route.coverage.percent === 0) {
          unavailable[mode] =
            "No se encontró infraestructura ciclista confirmada o estimada en la ruta conectada.";
          continue;
        }
        const duplicate = options.find((option) =>
          sameRoute(option.route, route),
        );
        if (duplicate) {
          duplicate.modes.push(mode);
          messages.push(
            "Dos modalidades coinciden en el mismo recorrido; se muestran juntas.",
          );
          continue;
        }
        options.push({ id: mode, modes: [mode], route });
      }
    const balanced = options.find((o) => o.modes.includes("balanced"));
    const priority = options.find((o) => o.modes.includes("cycleway_priority"));
    if (
      balanced &&
      priority &&
      balanced.id !== priority.id &&
      balanced.id !== "fast" &&
      priority.id !== "fast"
    )
      recommendedId = balanced.id;
  }
  messages.push(
    "OSM puede estar incompleto. La clasificación no certifica seguridad ni estado físico.",
  );
  return {
    options,
    unavailable,
    recommendedId,
    messages: [...new Set(messages)],
  };
}
