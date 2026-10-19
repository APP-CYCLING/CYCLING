const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
const cache = new Map();
function load(file, modules = {}) {
  const absolute = path.resolve(__dirname, "..", file);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Date,
    Map,
    Set,
    Error,
    Math,
    require: (name) =>
      name in modules
        ? modules[name]
        : name.endsWith(".png")
          ? 1
          : load(
              path.relative(
                path.resolve(__dirname, ".."),
                path.resolve(path.dirname(absolute), name),
              ),
            ),
  });
  return exports;
}
const g = load("supabase/functions/_shared/cycling-graph.ts"),
  d = load("supabase/functions/_shared/domain.ts"),
  options = load("supabase/functions/_shared/route-options.ts");
test("a single Geoapify MultiLineString leg is supported without connecting multiple legs", () => {
  const line = {
    distanceMeters: 1000,
    durationSeconds: 200,
    geometry: {
      type: "LineString",
      coordinates: [
        [-77, -12],
        [-76.99, -12],
      ],
    },
  };
  const single = {
    ...line,
    geometry: {
      type: "MultiLineString",
      coordinates: [line.geometry.coordinates],
    },
  };
  assert.deepEqual(
    Array.from(options.corridor(single)),
    Array.from(options.corridor(line)),
  );
  assert.equal(
    options.corridor({
      ...line,
      geometry: {
        type: "MultiLineString",
        coordinates: [line.geometry.coordinates, line.geometry.coordinates],
      },
    }),
    null,
  );
});
const coordinates = {
  1: [-77, -12],
  2: [-76.999, -12],
  3: [-76.998, -12],
  4: [-77, -11.9997],
  5: [-76.999, -11.9997],
  6: [-76.998, -11.9997],
  7: [-77, -12.0002],
  8: [-76.999, -12.0002],
  9: [-76.998, -12.0002],
};
const way = (
  id,
  nodes,
  tags = { highway: "residential" },
  pos = coordinates,
) => ({
  type: "way",
  id,
  nodes,
  tags,
  geometry: nodes.map((n) => ({ lon: pos[n][0], lat: pos[n][1] })),
});
const network = () => [
  way(10, [1, 2, 3]),
  way(20, [1, 4], { highway: "residential" }),
  way(21, [4, 5, 6], { highway: "cycleway" }),
  way(22, [6, 3], { highway: "residential" }),
  way(30, [1, 7], { highway: "residential" }),
  way(31, [7, 8, 9], { highway: "residential", cycleway: "lane" }),
  way(32, [9, 3], { highway: "residential" }),
];
const route = () => ({
  distanceMeters: g.meters(coordinates[1], coordinates[3]),
  durationSeconds: 50,
  geometry: {
    type: "LineString",
    coordinates: [coordinates[1], coordinates[2], coordinates[3]],
  },
  steps: [],
});
test("classification separates exclusive lanes from bicycle permission, advisory and unconfirmed tags", () => {
  assert.equal(
    d.classifyLane({ bicycle: "yes", highway: "residential" }),
    "shared",
  );
  assert.equal(d.classifyLane({ bicycle: "no", highway: "cycleway" }), null);
  const raw = {
    elements: [
      way(1, [1, 2], {
        highway: "residential",
        "cycleway:left": "track",
        "cycleway:right": "lane",
      }),
      way(2, [2, 3], {
        highway: "residential",
        cycleway: "lane",
        "cycleway:lane": "advisory",
      }),
      way(3, [4, 5], { highway: "residential", cycleway: "separate" }),
    ],
  };
  const features = d.normalizeLanes(raw).features;
  assert.deepEqual(
    Array.from(features.slice(0, 2), (f) => f.properties.side),
    ["left", "right"],
  );
  assert.equal(features[0].properties.geometryBasis, "visual_offset");
  assert.equal(features[1].properties.infrastructure, "lane");
  assert.equal(features[2].properties.infrastructure, "shared");
  assert.equal(features[3].properties.infrastructure, "unknown");
});
test("independent cycleway retains its true geometry and duplicated OSM IDs are not counted twice", () => {
  const a = way(20, [4, 5, 6], { highway: "cycleway" });
  const result = d.normalizeLanes({ elements: [a, a] });
  assert.equal(result.features.length, 1);
  assert.equal(result.features[0].properties.side, "center");
  assert.equal(result.features[0].properties.geometryBasis, "independent");
  assert.equal(
    JSON.stringify(result.features[0].geometry.coordinates),
    JSON.stringify([coordinates[4], coordinates[5], coordinates[6]]),
  );
});
test("costs actually change the path: fast uses carriageway, priority uses segregated and balanced uses a shorter lane", () => {
  const graph = g.buildGraph(network());
  const fast = g.shortest(graph, "1", "3", "fast"),
    priority = g.shortest(graph, "1", "3", "cycleway_priority"),
    balanced = g.shortest(graph, "1", "3", "balanced");
  assert.ok(fast.every((e) => e.way === 10));
  assert.ok(priority.some((e) => e.way === 21));
  assert.ok(balanced.some((e) => e.way === 31));
  assert.ok(!balanced.some((e) => e.way === 21));
});
test("coverage is length-weighted over traversed directed OSM edges, excluding shared and unknown roads", () => {
  const graph = g.buildGraph(network()),
    path = g.shortest(graph, "1", "3", "cycleway_priority"),
    summary = g.summarize(path);
  const segregated = path
    .filter((e) => e.way === 21)
    .reduce((s, e) => s + e.meters, 0);
  assert.ok(
    Math.abs(
      summary.coverage.percent - (100 * segregated) / summary.distanceMeters,
    ) < 1e-8,
  );
  assert.equal(summary.coverage.laneMeters, 0);
  assert.ok(summary.coverage.transitions >= 2);
  assert.ok(summary.durationSeconds > 0);
  assert.equal(summary.durationSource, "cycling_model");
});
test("parallel roads within meters never gain a graph connection without a shared OSM node", () => {
  const p = {
    ...coordinates,
    11: [-77, -11.99999],
    12: [-76.999, -11.99999],
    13: [-76.998, -11.99999],
  };
  const graph = g.buildGraph([
    way(10, [1, 2, 3]),
    way(11, [11, 12, 13], { highway: "cycleway" }, p),
  ]);
  assert.equal(g.shortest(graph, "1", "13", "cycleway_priority"), null);
  assert.ok(
    g.shortest(graph, "1", "3", "cycleway_priority").every((e) => e.way === 10),
  );
});
test("crossing geometries with different node IDs and grade separation do not connect", () => {
  const p = { ...coordinates, 11: [-76.999, -12], 12: [-76.999, -11.999] };
  const graph = g.buildGraph([
    way(10, [1, 2, 3]),
    way(11, [11, 12], { highway: "cycleway", bridge: "yes", layer: "1" }, p),
  ]);
  assert.equal(g.shortest(graph, "1", "12", "balanced"), null);
});
test("one-way restrictions, explicit bicycle exceptions and reverse one-way are respected", () => {
  const graph = g.buildGraph([
    way(10, [1, 2, 3], { highway: "residential", oneway: "yes" }),
  ]);
  assert.ok(g.shortest(graph, "1", "3", "balanced"));
  assert.equal(g.shortest(graph, "3", "1", "balanced"), null);
  const exception = g.buildGraph([
    way(10, [1, 2, 3], {
      highway: "residential",
      oneway: "yes",
      "oneway:bicycle": "no",
    }),
  ]);
  assert.ok(g.shortest(exception, "3", "1", "balanced"));
  const reversed = g.buildGraph([
    way(10, [1, 2, 3], { highway: "residential", oneway: "-1" }),
  ]);
  assert.equal(g.shortest(reversed, "1", "3", "balanced"), null);
  assert.ok(g.shortest(reversed, "3", "1", "balanced"));
});
test("prohibitions, barriers and unsupported conditional access cannot create usable links", () => {
  for (const tags of [
    { highway: "cycleway", bicycle: "no" },
    { highway: "residential", access: "private" },
    { highway: "residential", "bicycle:conditional": "yes @ (Mo-Fr)" },
    { highway: "motorway", bicycle: "yes" },
  ])
    assert.equal(
      g.shortest(
        g.buildGraph([way(10, [1, 2, 3], tags)]),
        "1",
        "3",
        "balanced",
      ),
      null,
    );
  const graph = g.buildGraph([
    way(10, [1, 2, 3]),
    { type: "node", id: 2, tags: { barrier: "gate" } },
  ]);
  assert.equal(g.shortest(graph, "1", "3", "balanced"), null);
});
test("turn restrictions prohibit invalid connections and exceptions for bicycles are supported", () => {
  const roads = [way(10, [1, 2]), way(11, [2, 3])];
  const restriction = {
    type: "relation",
    id: 99,
    tags: { type: "restriction", restriction: "no_straight_on" },
    members: [
      { type: "way", role: "from", ref: 10 },
      { type: "node", role: "via", ref: 2 },
      { type: "way", role: "to", ref: 11 },
    ],
  };
  assert.equal(
    g.shortest(g.buildGraph([...roads, restriction]), "1", "3", "balanced"),
    null,
  );
  assert.ok(
    g.shortest(
      g.buildGraph([
        ...roads,
        { ...restriction, tags: { ...restriction.tags, except: "bicycle" } },
      ]),
      "1",
      "3",
      "balanced",
    ),
  );
});
test("anchors in the middle of a single OSM edge split it without a forced detour or reverse violation", () => {
  const graph = g.buildGraph([
    way(10, [1, 3], { highway: "residential", oneway: "yes" }),
  ]);
  assert.equal(g.attach(graph, [-76.9998, -12], "origin"), true);
  assert.equal(g.attach(graph, [-76.9982, -12], "destination"), true);
  const path = g.shortest(graph, "origin", "destination", "fast");
  assert.ok(path?.length);
  assert.ok(
    Math.abs(
      g.summarize(path).distanceMeters -
        g.meters([-76.9998, -12], [-76.9982, -12]),
    ) < 0.01,
  );
  assert.equal(g.shortest(graph, "destination", "origin", "fast"), null);
});
test("an anchor between two nearly coincident but unrelated ways is rejected as ambiguous", () => {
  const p = {
    ...coordinates,
    11: [-77, -11.999998],
    13: [-76.998, -11.999998],
  };
  const graph = g.buildGraph([
    way(10, [1, 3]),
    way(11, [11, 13], { highway: "cycleway" }, p),
  ]);
  assert.equal(g.attach(graph, [-76.999, -11.999999], "origin"), false);
});
test("three distinct options contain real metrics and only comparable graph alternatives earn recommendation", () => {
  const result = options.buildOptions(route(), network());
  assert.equal(result.options.length, 3);
  assert.equal(result.recommendedId, "balanced");
  assert.equal(result.options[0].route.coverage.percent, null);
  assert.ok(
    result.options[1].route.coverage.segregatedMeters >
      result.options[2].route.coverage.segregatedMeters,
  );
});
test("without lanes or a connected cycleway path modes are unavailable, never fabricated", () => {
  const empty = options.buildOptions(route(), [way(10, [1, 2, 3])]);
  assert.equal(empty.options.length, 1);
  assert.ok(empty.unavailable.cycleway_priority);
  assert.equal(empty.recommendedId, null);
  const failed = options.buildOptions(route(), null, "OSM no disponible");
  assert.equal(failed.options.length, 1);
  assert.equal(failed.unavailable.balanced, "OSM no disponible");
});
test("identical modes share one card and essentially identical geometry is deduplicated", () => {
  const result = options.buildOptions(route(), [
    way(10, [1, 2, 3], { highway: "cycleway" }),
  ]);
  assert.equal(result.options.length, 1);
  assert.equal(result.options[0].modes.length, 3);
  assert.equal(result.recommendedId, null);
  assert.equal(
    options.sameRoute(route(), {
      ...route(),
      geometry: {
        type: "LineString",
        coordinates: [coordinates[1], coordinates[3]],
      },
    }),
    true,
  );
});
test("long corridors and multipart routes are declined by the local graph, not joined with invented lines", () => {
  assert.equal(
    options.corridor({
      ...route(),
      geometry: {
        type: "LineString",
        coordinates: [
          [-77, -12],
          [-76, -12],
        ],
      },
    }),
    null,
  );
  assert.equal(
    options.corridor({
      ...route(),
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [coordinates[1], coordinates[2]],
          [coordinates[4], coordinates[5]],
        ],
      },
    }),
    null,
  );
});

test("MapLibre cycleway layers validate against the real style specification with lateral offsets and line symbols", () => {
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...props, children },
  });
  const layers = load(
    "apps/mobile/src/modules/maps/components/CycleInfrastructureLayers.tsx",
    {
      react: { createElement, Fragment: "Fragment" },
      "@maplibre/maplibre-react-native": {
        GeoJSONSource: "Source",
        Images: "Images",
        Layer: "Layer",
      },
    },
  );
  const data = d.normalizeLanes({
    elements: [
      way(10, [1, 2], { highway: "residential", "cycleway:left": "track" }),
    ],
  });
  const find = (tree) =>
    !tree || typeof tree !== "object"
      ? []
      : Array.isArray(tree)
        ? tree.flatMap(find)
        : [
            ...(tree.type === "Layer" ? [tree.props] : []),
            ...find(tree.props?.children),
          ];
  const specs = [
    ...find(layers.CycleInfrastructureLayers({ data })),
    ...find(layers.CyclewaySymbols()),
  ].map(({ children, beforeId, ...layer }) => ({
    ...layer,
    source: "osm-cycleways",
  }));
  const errors = require("@maplibre/maplibre-gl-style-spec").validateStyleMin({
    version: 8,
    sources: {
      "osm-cycleways": {
        type: "geojson",
        data: JSON.parse(JSON.stringify(data)),
      },
    },
    layers: JSON.parse(JSON.stringify(specs)),
  });
  assert.deepEqual(
    errors.map((e) => e.message),
    [],
  );
  assert.equal(
    specs.find((layer) => layer.id === "cycleway-bikes").layout[
      "symbol-placement"
    ],
    "line",
  );
  const offset = JSON.stringify(
    specs.find((layer) => layer.id === "cycleway-segregated").paint[
      "line-offset"
    ],
  );
  assert.ok(offset.includes('"left",-7,"right",7'));
  assert.equal(
    data.features[0].geometry.coordinates[0][0],
    -77,
    "rendering must not move OSM coordinates",
  );
});

test("gray road presentation preserves all road geometry sources, widths, arrows and labels", () => {
  const { roadPresentation } = load(
    "apps/mobile/src/modules/maps/utils/road-presentation.ts",
  );
  const original = {
    version: 8,
    sources: {
      base: { type: "vector", url: "https://example.test/tiles.json" },
    },
    layers: [
      {
        id: "Road",
        type: "line",
        source: "base",
        "source-layer": "transportation",
        paint: { "line-color": "yellow", "line-width": 6 },
      },
      {
        id: "Road casing",
        type: "line",
        source: "base",
        "source-layer": "transportation",
        paint: { "line-color": "red", "line-width": 8 },
      },
      {
        id: "Street names",
        type: "symbol",
        source: "base",
        "source-layer": "transportation_name",
        layout: { "text-field": ["get", "name"] },
      },
    ],
  };
  const result = roadPresentation(original);
  assert.equal(result.sources, original.sources);
  assert.equal(result.layers[0].paint["line-color"], "#CBD0D0");
  assert.equal(result.layers[0].paint["line-width"], 6);
  assert.equal(result.layers[1].paint["line-color"], "#747C7D");
  assert.equal(result.layers[2], original.layers[2]);
  assert.equal(original.layers[0].paint["line-color"], "yellow");
});

test("excessive detours are not offered even when a segregated path exists", () => {
  const p = { ...coordinates, 4: [-77, -11.998], 6: [-76.998, -11.998] };
  const result = options.buildOptions(route(), [
    way(20, [1, 4, 6, 3], { highway: "cycleway" }, p),
  ]);
  assert.equal(result.options.length, 1);
  assert.match(result.unavailable.cycleway_priority, /desvío excesivo/);
});

test("the UI exposes only distinct routes with real metrics and unavailable modes as explanations", () => {
  let selected;
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...props, children },
  });
  const { RouteAlternativesSelector } = load(
    "apps/mobile/src/modules/route-planner/components/RouteAlternativesSelector.tsx",
    {
      react: { createElement },
      "react-native": {
        Pressable: "Choice",
        View: "View",
        Modal: "Modal",
        ScrollView: "ScrollView",
        useWindowDimensions: () => ({ height: 800 }),
        Alert: { alert() {} },
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ bottom: 16 }),
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "../../../shared/components/BrandLoader": { BrandLoader: "Loader" },
      "./ElevationProfile": {
        ElevationProfileButton: "Profile",
        elevationLabel: (route) =>
          route.elevationGainMeters == null
            ? "Sin datos"
            : `${Math.round(route.elevationGainMeters)} m`,
      },
      "../../../shared/components/DesignSystem": { AppText: "Text" },
      "../../../shared/theme/ThemeContext": { useThemeColors: () => ({}) },
    },
  );
  const alternatives = options.buildOptions(route(), network());
  const tree = RouteAlternativesSelector({
    alternatives,
    selected: alternatives.options[0].route,
    onSelect: (id) => {
      selected = id;
    },
  });
  const find = (tree) =>
    !tree || typeof tree !== "object"
      ? []
      : Array.isArray(tree)
        ? tree.flatMap(find)
        : [
            ...(tree.type === "Choice" &&
            tree.props.accessibilityRole === "radio"
              ? [tree.props]
              : []),
            ...find(tree.props?.children),
          ];
  const choices = find(tree);
  assert.equal(choices.length, 3);
  assert.equal(choices[0].accessibilityState.selected, true);
  choices[2].onPress();
  assert.equal(selected, "balanced");
  const duplicates = options.buildOptions(route(), [
    way(10, [1, 2, 3], { highway: "cycleway" }),
  ]);
  assert.equal(
    find(
      RouteAlternativesSelector({
        alternatives: duplicates,
        selected: null,
        onSelect() {},
      }),
    ).length,
    1,
  );
});

test("a conflicting shared-node coordinate is rejected rather than drawing an invented connector", () => {
  const p = { ...coordinates, 2: [-76.995, -12] };
  assert.throws(
    () =>
      g.buildGraph([
        way(10, [1, 2]),
        way(11, [2, 3], { highway: "cycleway" }, p),
      ]),
    /nodos incompatibles/,
  );
});

test("graph duplicates do not increase edge counts and dense workloads stop at the configured limit", () => {
  const a = way(10, [1, 2, 3]);
  assert.equal(g.buildGraph([a, a]).count, g.buildGraph([a]).count);
  assert.throws(
    () =>
      g.buildGraph(
        Array.from({ length: g.ROUTING_POLICY.maxWays + 1 }, (_, id) => ({
          ...a,
          id,
        })),
      ),
    /demasiadas vías/,
  );
});
