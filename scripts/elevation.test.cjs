const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(file, modules = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    TextEncoder,
    Uint8Array,
    URL,
    Date,
    Map,
    Set,
    Promise,
    crypto: require("node:crypto").webcrypto,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected import ${name}`);
      return modules[name];
    },
    ...globals,
  });
  return exports;
}
const elevation = load("supabase/functions/_shared/elevation.ts");
const profile = (heights) =>
  heights.map((elevationMeters, i) => ({
    distanceMeters: i * 50,
    elevationMeters,
    segmentIndex: 0,
  }));
const summary = (heights) =>
  elevation.summarizeElevation(profile(heights), "maptiler", 50);
const geometry = {
  type: "LineString",
  coordinates: [
    [-77, -12],
    [-76.99, -12],
  ],
};
const route = { geometry, distanceMeters: 1088, durationSeconds: 240 };
test("flat routes produce known zero gain/loss instead of missing values", () => {
  const r = summary([12, 12, 12, 12]);
  assert.equal(r.elevationStatus, "ready");
  assert.equal(r.elevationGainMeters, 0);
  assert.equal(r.elevationLossMeters, 0);
  assert.equal(r.minElevationMeters, 12);
});
test("sums all climbs and descents, not destination minus origin", () => {
  const r = summary([0, 10, 20, 20, 20, 10, 0]);
  assert.equal(r.elevationGainMeters, 20);
  assert.equal(r.elevationLossMeters, 20);
  assert.equal(r.maxElevationMeters, 20);
});
test("negative heights are valid and do not become unknown or zero", () => {
  const r = summary([-20, -10, 0, 0, 0, -10, -20]);
  assert.equal(r.minElevationMeters, -20);
  assert.equal(r.elevationGainMeters, 20);
  assert.equal(r.elevationLossMeters, 20);
});
test("median removes isolated spikes and deadband suppresses sub-meter noise", () => {
  assert.equal(summary([10, 10, 1000, 10, 10]).elevationGainMeters, 0);
  const noisy = summary([10, 10.6, 9.6, 10.5, 9.7, 10]);
  assert.equal(noisy.elevationGainMeters, 0);
  assert.equal(noisy.elevationLossMeters, 0);
  assert.equal(
    summary([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]).elevationGainMeters,
    4,
    "small sustained slopes must accumulate",
  );
});
test("missing points remain gaps and invalidate full-route totals", () => {
  const r = summary([0, 1, null, 3, 4]);
  assert.equal(r.elevationStatus, "partial");
  assert.equal(r.elevationGainMeters, null);
  assert.equal(r.elevationLossMeters, null);
  assert.equal(r.elevationProfile[2].elevationMeters, null);
  assert.equal(summary([null, null]).elevationStatus, "error");
  assert.equal(summary([0, NaN, 10]).elevationStatus, "partial");
});
test("sampling follows actual segments, includes endpoints and caps cost at 100 points", () => {
  const { samples } = elevation.sampleGeometry({
    type: "LineString",
    coordinates: [
      [-77, -12],
      [-77, -11.99],
      [-76.99, -11.99],
    ],
  });
  assert.ok(samples.length <= 100);
  assert.deepEqual(Array.from(samples[0].coordinate), [-77, -12]);
  assert.deepEqual(Array.from(samples.at(-1).coordinate), [-76.99, -11.99]);
  assert.ok(
    samples.some((p) => p.coordinate[0] === -77 && p.coordinate[1] > -12),
  );
  assert.ok(
    elevation.sampleGeometry({
      type: "LineString",
      coordinates: [
        [-77, -12],
        [-76.5, -12],
      ],
    }).samples.length <= 100,
  );
  assert.throws(
    () =>
      elevation.sampleGeometry({
        type: "LineString",
        coordinates: [
          [-77, -12],
          [-75, -12],
        ],
      }),
    /100 km/,
  );
});
test("disconnected legs never create an elevation jump or invented connector", () => {
  const r = elevation.summarizeElevation(
    [
      { distanceMeters: 0, elevationMeters: 0, segmentIndex: 0 },
      { distanceMeters: 50, elevationMeters: 0, segmentIndex: 0 },
      { distanceMeters: 50, elevationMeters: 500, segmentIndex: 1 },
      { distanceMeters: 100, elevationMeters: 500, segmentIndex: 1 },
    ],
    "maptiler",
    50,
  );
  assert.equal(r.elevationGainMeters, 0);
  assert.equal(r.elevationLossMeters, 0);
  const g = elevation.sampleGeometry({
    type: "MultiLineString",
    coordinates: [
      [
        [-77, -12],
        [-76.999, -12],
      ],
      [
        [-76, -12],
        [-75.999, -12],
      ],
    ],
  });
  assert.ok(g.samples.at(-1).distanceMeters < 250);
});
test("Geoapify elevation_range is parsed in meters with independent leg distances", () => {
  const leg = {
    distance: 200,
    elevation_range: [
      [0, 10],
      [50, 20],
      [100, 20],
      [150, 20],
      [200, 10],
    ],
    steps: [{ elevation_gain: 99999 }],
  };
  const r = elevation.geoapifyElevation({ legs: [leg] }, geometry);
  assert.equal(r.elevationSource, "geoapify");
  assert.equal(r.elevationGainMeters, 10);
  assert.equal(r.elevationLossMeters, 10);
  assert.equal(r.elevationProfile.at(-1).distanceMeters, 200);
  const multi = elevation.geoapifyElevation(
    {
      legs: [
        leg,
        {
          ...leg,
          elevation_range: [
            [0, -10],
            [50, -10],
            [100, -10],
            [150, -10],
            [200, -10],
          ],
        },
      ],
    },
    {
      type: "MultiLineString",
      coordinates: [geometry.coordinates, geometry.coordinates],
    },
  );
  assert.equal(multi.elevationGainMeters, 10);
  assert.equal(multi.elevationLossMeters, 10);
  assert.equal(multi.elevationProfile.at(-1).distanceMeters, 400);
});
test("Geoapify aligned height arrays work; malformed profiles never break route geometry", () => {
  const r = elevation.geoapifyElevation(
    { legs: [{ elevation: [-10, -10] }] },
    geometry,
  );
  assert.equal(r.elevationStatus, "ready");
  assert.equal(r.minElevationMeters, -10);
  assert.equal(
    elevation.geoapifyElevation(
      {
        legs: [
          {
            elevation_range: [
              [0, 4],
              [100, 5],
              [20, 6],
            ],
          },
        ],
      },
      geometry,
    ).elevationStatus,
    "error",
  );
  const r2 = elevation.geoapifyElevation(
    {
      legs: [
        {
          elevation_range: [
            [0, 4],
            [10, null],
            [100, 5],
          ],
        },
      ],
    },
    geometry,
  );
  assert.equal(r2.elevationStatus, "partial");
  assert.equal(r2.elevationGainMeters, null);
  const domain = load("supabase/functions/_shared/domain.ts", {
    "./elevation.ts": elevation,
  });
  const normalized = domain.normalizeRoute({
    features: [{ geometry, properties: { distance: 1000, time: 240 } }],
  });
  assert.equal(normalized.geometry.type, "LineString");
  assert.equal(normalized.elevationGainMeters, null);
});
function backend({
  providerFail = false,
  quota = true,
  cacheFail = false,
} = {}) {
  const rows = new Map(),
    calls = [],
    rpc = [];
  const admin = {
    from: () => {
      let key,
        mode = "select",
        before;
      const query = {
        select() {
          return this;
        },
        eq(_, value) {
          key = value;
          return this;
        },
        gt() {
          return this;
        },
        lt(_, value) {
          before = value;
          return this;
        },
        async maybeSingle() {
          return {
            data: rows.get(key) || null,
            error: cacheFail ? { message: "offline" } : null,
          };
        },
        async upsert(row) {
          rows.set(row.cache_key, row);
          return { error: null };
        },
        async insert(row) {
          if (rows.has(row.cache_key)) return { error: { code: "23505" } };
          rows.set(row.cache_key, row);
          return { error: null };
        },
        delete() {
          mode = "delete";
          return this;
        },
        then(resolve) {
          if (
            mode === "delete" &&
            key &&
            (!before || rows.get(key)?.expires_at < before)
          )
            rows.delete(key);
          resolve({ error: null });
        },
      };
      return query;
    },
    async rpc(name, args) {
      rpc.push({ name, args });
      return { data: quota, error: null };
    },
  };
  const service = load(
    "supabase/functions/_shared/elevation-service.ts",
    {
      "./elevation.ts": elevation,
      "./http.ts": {
        fetchJson: async (url) => {
          calls.push(url);
          if (providerFail) throw new Error("private URL key=secret");
          const coords = new URL(url).pathname
            .replace("/elevation/", "")
            .replace(".json", "")
            .split(";")
            .map((p) => p.split(",").map(Number));
          return coords.map(([x, y]) => [x, y, Math.round((x + 78) * 100)]);
        },
      },
    },
    { Deno: { env: { get: () => "server-only-secret" } } },
  );
  return { service, admin, rows, calls, rpc };
}
test("same geometry reuses elevation cache; different geometry gets its own heights", async () => {
  const b = backend();
  const a = await b.service.enrichElevation(route, b.admin, "user");
  assert.equal(a.elevationSource, "maptiler");
  const count = b.calls.length;
  const again = await b.service.enrichElevation(route, b.admin, "user");
  assert.equal(b.calls.length, count);
  assert.equal(a.elevationGainMeters, again.elevationGainMeters);
  const different = {
    ...route,
    geometry: {
      type: "LineString",
      coordinates: [
        [-76, -12],
        [-75.99, -12],
      ],
    },
  };
  const other = await b.service.enrichElevation(different, b.admin, "user");
  assert.ok(b.calls.length > count);
  assert.notEqual(other.minElevationMeters, a.minElevationMeters);
  assert.ok([...b.rows.keys()].every((k) => !k.endsWith(":lock")));
});
test("MapTiler batches at most 50 positions and charges shared quota per batch", async () => {
  const b = backend();
  await b.service.enrichElevation(
    {
      ...route,
      geometry: {
        type: "LineString",
        coordinates: [
          [-77, -12],
          [-76.8, -12],
        ],
      },
    },
    b.admin,
    "user",
  );
  assert.equal(b.calls.length, 2);
  assert.equal(b.rpc.length, 2);
  assert.ok(
    b.calls.every((url) => new URL(url).pathname.split(";").length <= 50),
  );
  assert.equal(b.rpc[0].args.p_user_id, "user");
});
test("concurrent requests share work within one instance", async () => {
  const b = backend();
  const [a, c] = await Promise.all([
    b.service.enrichElevation(route, b.admin, "a"),
    b.service.enrichElevation(route, b.admin, "a"),
  ]);
  assert.equal(b.calls.length, 1);
  assert.equal(a.elevationGainMeters, c.elevationGainMeters);
});
test("provider errors, quota rejection and cache outage preserve route and unknown totals", async () => {
  for (const options of [
    { providerFail: true },
    { quota: false },
    { cacheFail: true },
  ]) {
    const b = backend(options),
      r = await b.service.enrichElevation(route, b.admin, "a");
    assert.equal(r.geometry, route.geometry);
    assert.equal(r.elevationStatus, "error");
    assert.equal(r.elevationGainMeters, null);
    assert.ok(!r.elevationError.includes("secret"));
    if (!options.providerFail) assert.equal(b.calls.length, 0);
  }
});
test("valid Geoapify profile needs no MapTiler calls and cached values contain no routing or credentials", async () => {
  const b = backend(),
    r = await b.service.enrichElevation(
      { ...route, ...summary([1, 1, 1]), elevationSource: "geoapify" },
      b.admin,
      "a",
    );
  assert.equal(r.elevationSource, "geoapify");
  assert.equal(b.calls.length, 0);
  const json = JSON.stringify([...b.rows.values()]);
  assert.ok(!json.includes("server-only-secret"));
  assert.ok(!json.includes("geometry"));
  assert.ok(!json.includes("userId"));
  const key = await b.service.elevationCacheKey(geometry, "maptiler");
  assert.ok(key.includes(elevation.ELEVATION_METHOD));
});

test("an active cross-instance lease prevents duplicate provider requests", async () => {
  const b = backend(),
    key = await b.service.elevationCacheKey(geometry, "maptiler");
  b.rows.set(`${key}:lock`, {
    expires_at: new Date(Date.now() + 60000).toISOString(),
    geojson: {},
  });
  const r = await b.service.enrichElevation(route, b.admin, "user");
  assert.equal(b.calls.length, 0);
  assert.equal(r.elevationStatus, "error");
  assert.match(r.elevationError, /procesando/);
});

test("a successful MapTiler fallback clears the earlier Geoapify error, including cache hits", async () => {
  const b = backend(),
    missing = { ...route, ...elevation.noElevation("Geoapify missing") };
  const first = await b.service.enrichElevation(missing, b.admin, "a");
  const cached = await b.service.enrichElevation(missing, b.admin, "a");
  for (const value of [first, cached]) {
    assert.equal(value.elevationStatus, "ready");
    assert.equal(value.elevationSource, "maptiler");
    assert.equal(value.elevationError, undefined);
  }
});

test("native profile exposes altitude selection, gaps and a flat chart without NaN", () => {
  let chosen;
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...props, children },
  });
  const module = load(
    "apps/mobile/src/modules/route-planner/components/ElevationProfile.tsx",
    {
      react: {
        createElement,
        useState: (value) => [
          value,
          (next) => {
            chosen = next;
          },
        ],
        useEffect: () => {},
      },
      "react-native": {
        View: "View",
        Pressable: "Pressable",
        Modal: "Modal",
        ScrollView: "Scroll",
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ bottom: 0, top: 0 }),
      },
      "../../../shared/components/DesignSystem": { AppText: "Text" },
      "../../../shared/components/BrandLoader": { BrandLoader: "Loader" },
      "../../../shared/theme/ThemeContext": { useThemeColors: () => ({}) },
    },
  );
  const flat = { ...route, ...summary([10, 10, 10]) };
  assert.equal(module.elevationLabel(flat), "0 m");
  assert.equal(module.elevationLabel({}), "Sin datos");
  const tree = module.ElevationProfile({ route: flat });
  assert.ok(!JSON.stringify(tree).includes("NaN"));
  const find = (tree) =>
    Array.isArray(tree)
      ? tree.flatMap(find)
      : tree && typeof tree === "object"
        ? [
            ...(tree.props?.accessibilityRole === "adjustable" ? [tree] : []),
            ...find(tree.props?.children),
          ]
        : [];
  const chart = find(tree)[0];
  chart.props.onTouchStart({ nativeEvent: { locationX: 1 } });
  assert.equal(chosen, 2);
  assert.match(chart.props.accessibilityValue.text, /10 metros/);
});

test("saved planned-route JSON retains elevation fields without database changes", () => {
  const mapper = load("apps/mobile/src/shared/supabase/mappers.ts"),
    planned = { ...route, ...summary([0, 10, 10, 10, 0]) };
  const saved = mapper.rideFromRow({
    id: "ride",
    planned_route: JSON.parse(JSON.stringify(planned)),
  });
  assert.equal(saved.plannedRoute.elevationGainMeters, 10);
  assert.equal(saved.plannedRoute.elevationProfile.length, 5);
  assert.equal(saved.plannedRoute.elevationSource, "maptiler");
});
