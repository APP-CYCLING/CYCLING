import { classifyLane } from "./domain.ts";

export type Position = [number, number];
export type Mode = "fast" | "cycleway_priority" | "balanced";
export type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
};
export type Edge = {
  from: string;
  to: string;
  way: number;
  a: Position;
  b: Position;
  meters: number;
  seconds: number;
  kind: "segregated" | "lane" | "shared" | "unknown";
  name: string;
  estimated: boolean;
};
type Restriction = { via: string; from: number; to: number; only: boolean };
export type Graph = {
  edges: Map<string, Edge[]>;
  restrictions: Restriction[];
  count: number;
};

// All costs and limits live here. Times are model estimates, never measured traffic.
export const ROUTING_POLICY = {
  maxWays: 6000,
  maxEdges: 60000,
  maxStates: 100000,
  maxSpanDegrees: 0.12,
  maxAreaDegrees: 0.0048,
  snapMeters: 1,
  ambiguousMeters: 0.25,
  minimumDistinctRatio: 0.04,
  maxDetour: { fast: 1, cycleway_priority: 1.6, balanced: 1.3 },
  speedKmh: { segregated: 18, lane: 17, shared: 16, unknown: 14 },
  costs: {
    fast: {
      time: 1,
      distance: 0.01,
      segregated: 1,
      lane: 1,
      shared: 1,
      unknown: 1,
      transition: 0,
    },
    cycleway_priority: {
      time: 0.4,
      distance: 0.06,
      segregated: 0.25,
      lane: 0.8,
      shared: 1.6,
      unknown: 1.8,
      transition: 8,
    },
    balanced: {
      time: 1,
      distance: 0.04,
      segregated: 0.75,
      lane: 0.9,
      shared: 1.3,
      unknown: 1.65,
      transition: 3,
    },
  },
};
export function meters(a: Position, b: Position) {
  const r = Math.PI / 180,
    y = (b[1] - a[1]) * r,
    x = (b[0] - a[0]) * r;
  return (
    12742000 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(y / 2) ** 2 +
            Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(x / 2) ** 2,
        ),
      ),
    )
  );
}
function allowed(t: Record<string, string>) {
  if (
    t.oneway &&
    !["yes", "no", "-1", "0", "1", "true", "false"].includes(t.oneway)
  )
    return false;
  if (
    t["oneway:bicycle"] &&
    !["yes", "no", "-1", "0", "1", "true", "false"].includes(
      t["oneway:bicycle"],
    )
  )
    return false;
  if (Object.keys(t).some((k) => k.includes("conditional"))) return false;
  if (
    [
      "no",
      "private",
      "destination",
      "delivery",
      "customers",
      "permit",
      "agricultural",
      "forestry",
    ].includes(t.access) ||
    [
      "no",
      "private",
      "dismount",
      "use_sidepath",
      "destination",
      "delivery",
      "customers",
      "permit",
    ].includes(t.bicycle)
  )
    return false;
  if (
    ["no", "private"].includes(t.vehicle) &&
    !["yes", "designated", "permissive"].includes(t.bicycle)
  )
    return false;
  if (
    [
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "construction",
      "proposed",
      "steps",
    ].includes(t.highway) ||
    t.motorroad === "yes"
  )
    return false;
  return (
    [
      "cycleway",
      "residential",
      "living_street",
      "service",
      "unclassified",
      "tertiary",
      "tertiary_link",
      "secondary",
      "secondary_link",
      "primary",
      "primary_link",
    ].includes(t.highway) ||
    (["path", "footway", "pedestrian", "track"].includes(t.highway) &&
      ["yes", "designated"].includes(t.bicycle))
  );
}
function kind(t: Record<string, string>, forward: boolean): Edge["kind"] {
  if (t.highway === "cycleway")
    return t.segregated === "no" ? "shared" : "segregated";
  // A sidepath attribute does not prove that the carriageway geometry is the
  // physically separate path. Favor it as an estimate, never as verified coverage.
  const k = classifyLane(t);
  if (k === "cycleway") return "segregated";
  if (k === "track") return "segregated";
  if (k === "lane") {
    if (
      t["cycleway:lane"] === "advisory" ||
      t["cycleway:left:lane"] === "advisory" ||
      t["cycleway:right:lane"] === "advisory"
    )
      return "shared";
    const sided = !!(t["cycleway:left"] || t["cycleway:right"]);
    // Right-hand traffic is not universal. Direction-dependent side attributes
    // need an explicit bicycle direction before counting either direction.
    if (sided && !t["cycleway:both"] && t["oneway:bicycle"] !== "yes")
      return "unknown";
    return forward || t["oneway:bicycle"] !== "yes" ? "lane" : "unknown";
  }
  return k === "shared" ? "shared" : "unknown";
}
export function buildGraph(elements: OSMElement[]): Graph {
  const graph: Graph = { edges: new Map(), restrictions: [], count: 0 };
  const excluded = new Set<number>(),
    blocked = new Set<string>(),
    seen = new Set<number>(),
    positions = new Map<number, Position>();
  for (const el of elements) {
    if (
      el.type === "node" &&
      (el.tags?.barrier ||
        el.tags?.bicycle === "no" ||
        ["no", "private"].includes(el.tags?.access ?? "") ||
        el.tags?.vehicle === "no") &&
      !["yes", "designated"].includes(el.tags?.bicycle ?? "")
    )
      blocked.add(String(el.id));
    if (
      el.type !== "relation" ||
      el.tags?.type !== "restriction" ||
      (el.tags.except ?? "").split(";").includes("bicycle")
    )
      continue;
    const rule = el.tags["restriction:bicycle"] || el.tags.restriction;
    const from = el.members?.find((m) => m.role === "from"),
      to = el.members?.find((m) => m.role === "to"),
      via = el.members?.find((m) => m.role === "via");
    if (
      !rule ||
      !from ||
      !to ||
      !via ||
      from.type !== "way" ||
      to.type !== "way" ||
      via.type !== "node" ||
      el.members?.filter((m) => m.role === "from").length !== 1 ||
      el.members?.filter((m) => m.role === "to").length !== 1 ||
      !/^(no_|only_)/.test(rule) ||
      Object.keys(el.tags).some((k) => k.includes("conditional"))
    ) {
      for (const m of el.members ?? [])
        if (m.type === "way") excluded.add(m.ref);
    } else
      graph.restrictions.push({
        via: String(via.ref),
        from: from.ref,
        to: to.ref,
        only: rule.startsWith("only_"),
      });
  }
  const ways = elements.filter((e) => e.type === "way");
  if (ways.length > ROUTING_POLICY.maxWays)
    throw new Error(
      "El corredor contiene demasiadas vías para el motor acotado.",
    );
  for (const way of ways) {
    if (
      seen.has(way.id) ||
      excluded.has(way.id) ||
      !way.tags ||
      !allowed(way.tags) ||
      !way.nodes ||
      !way.geometry ||
      way.nodes.length !== way.geometry.length
    )
      continue;
    seen.add(way.id);
    const t = way.tags;
    const oneway =
      t["oneway:bicycle"] ??
      (t.junction === "roundabout" ? (t.oneway ?? "yes") : t.oneway);
    const opposite = Object.values(t).some((v) =>
      ["opposite_lane", "opposite_track"].includes(v),
    );
    for (let i = 1; i < way.nodes.length; i++) {
      const from = String(way.nodes[i - 1]),
        to = String(way.nodes[i]);
      if (blocked.has(from) || blocked.has(to)) continue;
      const a: Position = [way.geometry[i - 1].lon, way.geometry[i - 1].lat],
        b: Position = [way.geometry[i].lon, way.geometry[i].lat];
      if (
        ![...a, ...b].every(Number.isFinite) ||
        Math.abs(a[0]) > 180 ||
        Math.abs(b[0]) > 180 ||
        Math.abs(a[1]) > 90 ||
        Math.abs(b[1]) > 90
      )
        continue;
      for (const [node, p] of [
        [way.nodes[i - 1], a],
        [way.nodes[i], b],
      ] as [number, Position][]) {
        const previous = positions.get(node);
        if (previous && meters(previous, p) > 0.5)
          throw new Error(
            "La geometría OSM contiene nodos incompatibles; no se conectará esa red.",
          );
        positions.set(node, p);
      }
      const length = meters(a, b);
      if (length < 0.05) continue;
      const add = (forward: boolean) => {
        const type = kind(t, forward),
          source = forward ? from : to;
        const edge: Edge = {
          from: source,
          to: forward ? to : from,
          way: way.id,
          a: forward ? a : b,
          b: forward ? b : a,
          meters: length,
          seconds: length / (ROUTING_POLICY.speedKmh[type] / 3.6),
          kind: type,
          name: t.name || "Vía sin nombre",
          estimated:
            !["cycleway", "path", "footway"].includes(t.highway) &&
            type !== "unknown",
        };
        const list = graph.edges.get(source) ?? [];
        list.push(edge);
        graph.edges.set(source, list);
        graph.count++;
      };
      if (oneway !== "-1" && t["bicycle:forward"] !== "no") add(true);
      if (
        t["bicycle:backward"] !== "no" &&
        (!["yes", "1", "true"].includes(oneway) ||
          (!t["oneway:bicycle"] && opposite))
      )
        add(false);
    }
  }
  if (graph.count > ROUTING_POLICY.maxEdges)
    throw new Error("La red excede el límite de cálculo.");
  return graph;
}

function projection(p: Position, a: Position, b: Position) {
  const scale = Math.cos((p[1] * Math.PI) / 180),
    x = (b[0] - a[0]) * scale,
    y = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * scale * x + (p[1] - a[1]) * y) / (x * x + y * y || 1),
    ),
  );
  const point: Position = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return { t, point, distance: meters(p, point) };
}
/** Attach only to uniquely matching geometry; never join nearby parallel ways. */
export function attach(graph: Graph, p: Position, id: string): boolean {
  const all = [...graph.edges.values()].flat();
  const hits = all
    .map((edge) => ({ edge, ...projection(p, edge.a, edge.b) }))
    .filter((h) => h.distance <= ROUTING_POLICY.snapMeters)
    .sort((a, b) => a.distance - b.distance);
  if (!hits.length) return false;
  const nearest = hits[0];
  const tied = hits.filter(
    (h) => h.distance <= nearest.distance + ROUTING_POLICY.ambiguousMeters,
  );
  const nodes = new Set(
    tied.flatMap((h) =>
      h.t < 0.001 ? [h.edge.from] : h.t > 0.999 ? [h.edge.to] : [],
    ),
  );
  if (new Set(tied.map((h) => h.edge.way)).size > 1 && nodes.size !== 1)
    return false;
  // At a real shared endpoint use that node's identity, including its turn rules.
  if (nodes.size === 1 && tied.every((h) => h.t < 0.001 || h.t > 0.999)) {
    const node = [...nodes][0];
    if (!graph.edges.has(node)) graph.edges.set(node, []);
    const anchor: Edge = {
      ...nearest.edge,
      from: id,
      to: node,
      a: p,
      b: p,
      meters: 0,
      seconds: 0,
      way: 0,
      kind: "unknown",
    };
    graph.edges.set(id, [anchor]);
    graph.edges.get(node)!.push({ ...anchor, from: node, to: id });
    return true;
  }
  if (nodes.size > 1) return false;
  const selected = all.filter(
    (e) =>
      e.way === nearest.edge.way &&
      ((e.from === nearest.edge.from && e.to === nearest.edge.to) ||
        (e.from === nearest.edge.to && e.to === nearest.edge.from)),
  );
  const outgoing: Edge[] = [];
  for (const e of selected) {
    const h = projection(p, e.a, e.b);
    outgoing.push({
      ...e,
      from: id,
      a: h.point,
      meters: e.meters * (1 - h.t),
      seconds: e.seconds * (1 - h.t),
    });
    const list = graph.edges.get(e.from)!.filter((item) => item !== e);
    list.push({
      ...e,
      to: id,
      b: h.point,
      meters: e.meters * h.t,
      seconds: e.seconds * h.t,
    });
    graph.edges.set(e.from, list);
  }
  graph.edges.set(id, outgoing);
  return true;
}

class Heap<T> {
  private a: { cost: number; value: T }[] = [];
  push(cost: number, value: T) {
    const x = { cost, value };
    this.a.push(x);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].cost <= cost) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = x;
  }
  pop() {
    if (!this.a.length) return null;
    const root = this.a[0],
      last = this.a.pop()!;
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1].cost < this.a[c].cost) c++;
        if (this.a[c].cost >= last.cost) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return root;
  }
}
export function shortest(
  graph: Graph,
  source: string,
  target: string,
  mode: Mode,
): Edge[] | null {
  type State = { node: string; way: number; kind: Edge["kind"]; key: string };
  const heap = new Heap<State>(),
    dist = new Map<string, number>(),
    prev = new Map<string, { key: string; edge: Edge }>();
  const first = { node: source, way: 0, kind: "unknown" as const, key: source };
  heap.push(0, first);
  dist.set(source, 0);
  const weights = ROUTING_POLICY.costs[mode];
  let expanded = 0;
  while (true) {
    const item = heap.pop();
    if (!item) return null;
    const { value: s, cost } = item;
    if (cost !== dist.get(s.key)) continue;
    if (++expanded > ROUTING_POLICY.maxStates) return null;
    if (s.node === target) {
      const path: Edge[] = [];
      let k = s.key;
      while (prev.has(k)) {
        const p = prev.get(k)!;
        path.push(p.edge);
        k = p.key;
      }
      return path.reverse().filter((e) => e.meters > 0);
    }
    for (const e of graph.edges.get(s.node) ?? []) {
      if (e.way === 0 && e.from !== source && e.to !== target) continue;
      if (
        e.way &&
        graph.restrictions.some(
          (r) =>
            r.via === s.node &&
            r.from === s.way &&
            (r.only ? e.way !== r.to : e.way === r.to),
        )
      )
        continue;
      const way = e.way || s.way,
        type = e.way ? e.kind : s.kind,
        key = `${e.to}:${way}:${type}`;
      const transition = s.way && s.kind !== type ? weights.transition : 0;
      const next =
        cost +
        (e.seconds * weights.time + e.meters * weights.distance) *
          weights[type] +
        transition;
      if (next < (dist.get(key) ?? Infinity)) {
        dist.set(key, next);
        prev.set(key, { key: s.key, edge: e });
        heap.push(next, { node: e.to, way, kind: type, key });
      }
    }
  }
}
export function summarize(path: Edge[]) {
  const total = path.reduce((n, e) => n + e.meters, 0),
    exclusive = path.filter(
      (e) => e.kind === "segregated" || e.kind === "lane",
    );
  const segregated = exclusive
    .filter((e) => e.kind === "segregated")
    .reduce((n, e) => n + e.meters, 0);
  const lanes = exclusive
    .filter((e) => e.kind === "lane")
    .reduce((n, e) => n + e.meters, 0);
  let transitions = 0;
  for (let i = 1; i < path.length; i++)
    if (path[i].kind !== path[i - 1].kind) transitions++;
  const bearing = (e: Edge) =>
    (Math.atan2(
      (e.b[0] - e.a[0]) * Math.cos((e.a[1] * Math.PI) / 180),
      e.b[1] - e.a[1],
    ) *
      180) /
    Math.PI;
  const steps: {
    legIndex: number;
    fromIndex: number;
    toIndex: number;
    instruction: string;
    maneuver: string;
    streetName: string;
  }[] = [];
  for (let i = 0; i < path.length; i++) {
    const edge = path[i],
      delta = i
        ? ((bearing(edge) - bearing(path[i - 1]) + 540) % 360) - 180
        : 0;
    const turn = Math.abs(delta) >= 35,
      previous = steps.at(-1);
    if (previous && previous.streetName === edge.name && !turn) {
      previous.toIndex = i + 1;
      continue;
    }
    steps.push({
      legIndex: 0,
      fromIndex: i,
      toIndex: i + 1,
      streetName: edge.name,
      instruction:
        i === 0
          ? `Comienza por ${edge.name}`
          : turn
            ? `${delta > 0 ? "Gira a la derecha" : "Gira a la izquierda"} hacia ${edge.name}`
            : `Continúa por ${edge.name}`,
      maneuver: turn ? (delta > 0 ? "Right" : "Left") : "Continue",
    });
  }
  return {
    distanceMeters: total,
    durationSeconds: path.reduce((n, e) => n + e.seconds, 0),
    coverage: {
      percent: total ? (100 * (segregated + lanes)) / total : 0,
      segregatedMeters: segregated,
      laneMeters: lanes,
      status: exclusive.some((e) => e.estimated)
        ? ("estimated" as const)
        : ("osm_topology" as const),
      transitions,
    },
    geometry: {
      type: "LineString" as const,
      coordinates: [path[0].a, ...path.map((e) => e.b)],
    },
    steps,
    durationSource: "cycling_model" as const,
  };
}
