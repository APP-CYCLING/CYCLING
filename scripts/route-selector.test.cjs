const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(file, modules = {}) {
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
    AbortController,
    Error,
    Date,
    Promise,
    crypto: require("node:crypto").webcrypto,
    require: (name) => {
      if (name === "./elevation.ts")
        return load("supabase/functions/_shared/elevation.ts");
      if (!(name in modules)) throw new Error(`Unexpected import ${name}`);
      return modules[name];
    },
  });
  return exports;
}
function hooks() {
  const cells = [];
  let cursor = 0,
    effects = [];
  return {
    react: {
      useState(value) {
        const i = cursor++;
        if (!(i in cells))
          cells[i] = typeof value === "function" ? value() : value;
        return [
          cells[i],
          (next) => {
            cells[i] = typeof next === "function" ? next(cells[i]) : next;
          },
        ];
      },
      useRef(value) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = { current: value };
        return cells[i];
      },
      useCallback: (fn) => fn,
      useEffect(fn, deps) {
        const i = cursor++,
          old = cells[i];
        if (!old || deps.some((dep, j) => old.deps[j] !== dep))
          effects.push(() => {
            old?.cleanup?.();
            cells[i] = { deps, cleanup: fn() };
          });
      },
    },
    render(fn) {
      cursor = 0;
      const value = fn();
      const pending = effects;
      effects = [];
      pending.forEach((fn) => fn());
      return value;
    },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { resolve, reject, promise };
}
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const origin = { latitude: -12, longitude: -77 },
  destination = {
    id: "d",
    label: "Destino",
    coordinate: { latitude: -12.01, longitude: -77.01 },
  };
const fast = {
  mode: "fast",
  distanceMeters: 1500,
  durationSeconds: 300,
  geometry: {
    type: "LineString",
    coordinates: [
      [-77, -12],
      [-77.01, -12.01],
    ],
  },
};
const cyclist = {
  ...fast,
  mode: "cycleway_priority",
  distanceMeters: 1800,
  geometry: {
    type: "LineString",
    coordinates: [
      [-77, -12],
      [-77.02, -12],
      [-77.01, -12.01],
    ],
  },
};
const balanced = {
  ...fast,
  mode: "balanced",
  distanceMeters: 1600,
  geometry: {
    type: "LineString",
    coordinates: [
      [-77, -12],
      [-77, -12.01],
      [-77.01, -12.01],
    ],
  },
};
const result = () => ({
  options: [fast, cyclist, balanced].map((route) => ({
    id: route.mode,
    modes: [route.mode],
    route: JSON.parse(JSON.stringify(route)),
  })),
  unavailable: {},
  recommendedId: "balanced",
  messages: [],
});
function setup() {
  const runtime = hooks(),
    calls = [],
    fastJobs = [],
    otherJobs = [];
  const { useRoutePlanner } = load(
    "apps/mobile/src/modules/route-planner/hooks/useRoutePlanner.ts",
    {
      react: runtime.react,
      "../services/planner.service": {
        plannerService: {
          fast: (from, to, signal) => {
            const job = deferred();
            fastJobs.push(job);
            calls.push({ phase: "fast", from, to, signal });
            return job.promise;
          },
          complete: (from, to, id, signal) => {
            const job = deferred();
            otherJobs.push(job);
            calls.push({ phase: "complete", id, from, to, signal });
            return job.promise;
          },
        },
      },
    },
  );
  const render = () => runtime.render(() => useRoutePlanner(origin));
  render().select(destination);
  render();
  return {
    render,
    calls,
    fastJobs,
    otherJobs,
    async ready() {
      const pending = render().calculate();
      fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
      await tick();
      otherJobs[0].resolve({ ...fast, alternatives: result() });
      await pending;
      return render();
    },
  };
}
test("fast is painted and selected while other modes are still pending; late recommendation never replaces it", async () => {
  const f = setup(),
    pending = f.render().calculate();
  assert.equal(f.render().optionsOpen, true);
  f.fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
  await tick();
  let value = f.render();
  const originalRoute = value.route;
  assert.equal(value.selectedRouteMode, "fast");
  assert.equal(value.route.geometry, fast.geometry);
  assert.equal(value.optionStates.fast.status, "ready");
  assert.equal(value.optionStates.balanced.status, "loading");
  assert.equal(value.loading, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].id, "job-1");
  f.otherJobs[0].resolve({ ...fast, alternatives: result() });
  await pending;
  value = f.render();
  assert.equal(value.selectedRouteMode, "fast");
  assert.equal(
    value.route,
    originalRoute,
    "late identical fast geometry must not recenter the map",
  );
  assert.equal(value.optionStates.balanced.status, "ready");
  assert.equal(value.loading, false);
});
test("cycling, balanced and fast selections replace actual geometry without extra API requests", async () => {
  const f = setup();
  await f.ready();
  for (const expected of [cyclist, balanced, fast]) {
    f.render().selectAlternative(expected.mode);
    const value = f.render();
    assert.equal(value.selectedRouteMode, expected.mode);
    assert.equal(
      JSON.stringify(value.route.geometry),
      JSON.stringify(expected.geometry),
    );
    assert.equal(value.route.distanceMeters, expected.distanceMeters);
  }
  assert.equal(f.calls.length, 2);
});

test("late elevation enrichment updates active metrics without changing the geometry reference", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({
    ...fast,
    elevationStatus: "error",
    elevationGainMeters: null,
    calculationId: "job",
  });
  await tick();
  const originalGeometry = f.render().route.geometry;
  assert.equal(f.render().route.elevationStatus, "loading");
  const options = result();
  options.options.forEach((option, i) => {
    option.route = {
      ...option.route,
      elevationStatus: "ready",
      elevationGainMeters: 10 + i * 20,
      elevationLossMeters: 5 + i * 10,
      elevationProfile: [
        { distanceMeters: 0, elevationMeters: i * 100, segmentIndex: 0 },
        {
          distanceMeters: 1000,
          elevationMeters: i * 100 + 10,
          segmentIndex: 0,
        },
      ],
    };
  });
  f.otherJobs[0].resolve({ ...fast, alternatives: options });
  await pending;
  assert.equal(f.render().route.elevationGainMeters, 10);
  assert.equal(f.render().route.geometry, originalGeometry);
  for (const [mode, gain] of [
    ["cycleway_priority", 30],
    ["balanced", 50],
    ["fast", 10],
  ]) {
    f.render().selectAlternative(mode);
    assert.equal(f.render().route.elevationGainMeters, gain);
    assert.equal(
      f.render().route.elevationProfile[0].elevationMeters,
      (gain - 10) * 5,
    );
  }
  assert.equal(f.calls.length, 2);
});

test("an optional completion failure ends the elevation loading indicator without disabling the route", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({
    ...fast,
    elevationStatus: "error",
    calculationId: "job",
  });
  await tick();
  f.otherJobs[0].reject(new Error("network"));
  await pending;
  assert.equal(f.render().route.elevationStatus, "error");
  assert.equal(f.render().optionStates.fast.status, "ready");
});
test("closing and reopening the panel preserves the selected route and does not trigger a calculation", async () => {
  const f = setup();
  await f.ready();
  f.render().selectAlternative("balanced");
  const selected = f.render().route;
  f.render().closeOptions();
  assert.equal(f.render().optionsOpen, false);
  assert.equal(f.render().route, selected);
  f.render().openOptions();
  assert.equal(f.render().optionsOpen, true);
  assert.equal(f.render().route, selected);
  assert.equal(f.calls.length, 2);
});
test("closing while alternatives load remains closed after their response", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
  await tick();
  f.render().closeOptions();
  f.otherJobs[0].resolve({ ...fast, alternatives: result() });
  await pending;
  assert.equal(f.render().optionsOpen, false);
});
test("new destination resets to fast and obsolete responses cannot overwrite it", async () => {
  const f = setup(),
    old = f.render().calculate();
  f.fastJobs[0].resolve({ ...fast, calculationId: "old" });
  await tick();
  const oldSignal = f.calls[0].signal;
  f.render().select({
    ...destination,
    id: "new",
    coordinate: { latitude: -12.02, longitude: -77.02 },
  });
  assert.equal(oldSignal.aborted, true);
  assert.equal(f.render().selectedRouteMode, "fast");
  assert.equal(f.render().route, null);
  const next = f.render().calculate();
  f.fastJobs[1].resolve({ ...fast, calculationId: "new" });
  await tick();
  f.otherJobs[0].resolve({ ...balanced, alternatives: result() });
  await old;
  assert.equal(f.render().route.mode, "fast");
  assert.equal(f.render().loading, true);
  f.otherJobs[1].resolve({ ...fast, alternatives: result() });
  await next;
  assert.equal(f.render().selectedRouteMode, "fast");
  assert.equal(f.render().loading, false);
});
test("failed optional computation leaves the fast route usable with individual error states", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
  await tick();
  f.otherJobs[0].reject(new Error("OSM timeout"));
  await pending;
  const value = f.render();
  assert.equal(value.route.mode, "fast");
  assert.equal(value.optionStates.fast.status, "ready");
  assert.equal(value.optionStates.cycleway_priority.status, "error");
  assert.equal(value.loading, false);
});
test("missing modes stay unavailable and cannot be selected", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
  await tick();
  f.otherJobs[0].resolve({
    ...fast,
    alternatives: {
      ...result(),
      options: [result().options[0]],
      unavailable: {
        cycleway_priority: "Red discontinua",
        balanced: "Sin datos",
      },
    },
  });
  await pending;
  f.render().selectAlternative("cycleway_priority");
  assert.equal(f.render().selectedRouteMode, "fast");
  assert.equal(f.render().optionStates.cycleway_priority.status, "unavailable");
});
test("a valid fallback is shown with an explanation if the completed result has no fast option", async () => {
  const f = setup(),
    pending = f.render().calculate();
  f.fastJobs[0].resolve({ ...fast, calculationId: "job-1" });
  await tick();
  f.otherJobs[0].resolve({
    ...cyclist,
    alternatives: {
      ...result(),
      options: [result().options[1]],
      unavailable: { fast: "No disponible" },
    },
  });
  await pending;
  assert.equal(f.render().selectedRouteMode, "cycleway_priority");
  assert.match(f.render().error, /Rápida no está disponible/);
});
test("double calculation requests are ignored while a search is running", async () => {
  const f = setup(),
    pending = f.render().calculate();
  await f.render().calculate();
  assert.equal(f.calls.length, 1);
  f.fastJobs[0].resolve({ ...fast, alternativesError: "Caché no disponible" });
  await pending;
  assert.equal(f.render().route.mode, "fast");
  assert.equal(f.calls.length, 1);
});
test("server calculation cache is bound to the authenticated account and exact origin and destination", () => {
  const domain = load("supabase/functions/_shared/domain.ts");
  const { cachedCalculation } = load(
    "supabase/functions/_shared/route-calculation.ts",
    { "./domain.ts": domain },
  );
  const value = {
    version: 1,
    userId: "user-a",
    origin,
    destination: destination.coordinate,
    route: fast,
  };
  assert.equal(
    cachedCalculation(value, "user-a", origin, destination.coordinate),
    fast,
  );
  assert.throws(
    () => cachedCalculation(value, "user-b", origin, destination.coordinate),
    /otra búsqueda/,
  );
  assert.throws(
    () =>
      cachedCalculation(
        value,
        "user-a",
        { ...origin, longitude: -78 },
        destination.coordinate,
      ),
    /otra búsqueda/,
  );
});
test("starting navigation uses exactly the selected route without invoking the routing provider", () => {
  const runtime = hooks(),
    pushes = [],
    plans = [];
  let closed = 0;
  const planner = {
    route: cyclist,
    routeOrigin: origin,
    destination,
    selectedRouteMode: "cycleway_priority",
    optionStates: { cycleway_priority: { status: "ready" } },
    calculate() {},
    closeOptions() {
      closed++;
    },
    select() {},
    cancel() {},
  };
  const { useMapPlanner } = load(
    "apps/mobile/src/modules/maps/hooks/useMapPlanner.ts",
    {
      react: runtime.react,
      "react-native": { Keyboard: { dismiss() {} } },
      "expo-router": { router: { push: (value) => pushes.push(value) } },
      "../../../shared/hooks/useScreenFocused": {
        useScreenFocused: () => true,
      },
      "../../geolocation/hooks/useUserLocation": {
        useUserLocation: () => ({ position: origin }),
      },
      "../../route-planner/hooks/useRoutePlanner": {
        useRoutePlanner: () => planner,
      },
      "../../route-planner/hooks/useDestinationSearch": {
        useDestinationSearch: () => ({}),
      },
      "../../bike-lanes/hooks/useVisibleBikeLanes": {
        useVisibleBikeLanes: () => ({}),
      },
      "../../auth/context/AuthContext": {
        useAuth: () => ({ user: { id: "user-a" } }),
      },
      "../../navigation/services/planned-ride.store": {
        setPlannedRide: (value) => plans.push(value),
      },
      "../../navigation/services/repeat-ride.store": {
        useRepeatRide: () => null,
        setRepeatRide() {},
      },
    },
  );
  const controller = runtime.render(useMapPlanner);
  assert.equal(pushes.length, 0);
  controller.begin();
  assert.equal(plans[0].route, cyclist);
  assert.equal(plans[0].origin, origin);
  assert.equal(closed, 1);
  assert.equal(pushes[0].pathname, "/ride");
});

test("two-phase Edge calculation calls Geoapify once and reuses the private server calculation for completion", async () => {
  let handler,
    providerCalls = 0,
    selectedKey;
  const rows = new Map();
  const domain = load("supabase/functions/_shared/domain.ts");
  const calculation = load("supabase/functions/_shared/route-calculation.ts", {
    "./domain.ts": domain,
  });
  const query = {
    select() {
      return this;
    },
    eq(_, key) {
      selectedKey = key;
      return this;
    },
    gt() {
      return this;
    },
    async maybeSingle() {
      return { data: rows.get(selectedKey) || null, error: null };
    },
    async upsert(row) {
      rows.set(row.cache_key, row);
      return { error: null };
    },
  };
  const admin = { from: () => query };
  load("supabase/functions/calculate-bike-route/index.ts", {
    "../_shared/elevation-service.ts": {
      enrichElevation: async (route) => route,
    },
    "../_shared/domain.ts": domain,
    "../_shared/route-calculation.ts": calculation,
    "../_shared/http.ts": {
      serve: (_, fn) => {
        handler = fn;
      },
      geoapifyUrl: () => new URL("https://example.test/routing"),
      fetchJson: async () => {
        providerCalls++;
        return {
          features: [
            {
              geometry: fast.geometry,
              properties: { distance: 1500, time: 300 },
            },
          ],
        };
      },
    },
    "../_shared/corridor-network.ts": { corridorNetwork: async () => [] },
    "../_shared/route-options.ts": {
      corridor: () => [-77, -12, -76.99, -11.99],
      buildOptions: (route) => ({
        options: [
          { id: "fast", modes: ["fast"], route: { ...route, mode: "fast" } },
        ],
        unavailable: {},
        recommendedId: null,
        messages: [],
      }),
    },
  });
  const base = { origin, destination: destination.coordinate };
  const first = await handler({ ...base, phase: "fast" }, admin, "user-a");
  assert.ok(first.calculationId);
  assert.equal(providerCalls, 1);
  const completed = await handler(
    { ...base, alternatives: true, calculationId: first.calculationId },
    admin,
    "user-a",
  );
  assert.equal(completed.alternatives.options[0].route.distanceMeters, 1500);
  assert.equal(
    providerCalls,
    1,
    "completing alternatives must not request Geoapify again",
  );
  await assert.rejects(
    handler(
      { ...base, alternatives: true, calculationId: first.calculationId },
      admin,
      "user-b",
    ),
    /otra búsqueda/,
  );
  assert.equal(providerCalls, 1);
});

test("changing the card or closing its modal keeps the same map parent and infrastructure source", () => {
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...props, children },
    key: props?.key ?? null,
  });
  const component = load(
    "apps/mobile/src/modules/maps/components/PlannerLayout.tsx",
    {
      react: {
        createElement,
        useMemo: (fn) => fn(),
        useState: (initial) => [initial, () => {}],
      },
      "react-native": {
        ActivityIndicator: "Spinner",
        Keyboard: { dismiss() {} },
        KeyboardAvoidingView: "KeyboardView",
        Platform: { OS: "android" },
        Pressable: "Button",
        ScrollView: "Scroll",
        StyleSheet: { create: (value) => value },
        TextInput: "Input",
        View: "View",
        useWindowDimensions: () => ({ height: 800 }),
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "expo-router": { router: {} },
      "../../route-planner/components/RouteAlternativesSelector": {
        RouteAlternativesSelector: "RouteSelector",
        RouteSelectionSummary: "Summary",
      },
      "./CyclingMap": { CyclingMap: "NativeMap" },
      "../../../shared/components/DesignSystem": Object.fromEntries(
        ["AppText", "Chip", "IconButton", "ScreenHeader"].map((name) => [
          name,
          name,
        ]),
      ),
      "../../../shared/components/UI": {
        Notice: "Notice",
        PrimaryButton: "Action",
      },
      "../../../shared/theme/ThemeContext": {
        useThemeColors: () => ({}),
        useThemedStyles: (fn) => fn({}),
      },
      "../../../shared/theme/typography": { fonts: {} },
      "../../../shared/theme/FontContext": { useFontFamily: () => undefined },
    },
  );
  const infrastructure = { type: "FeatureCollection", features: [] };
  const c = {
    gps: { position: origin, status: "ready" },
    origin,
    displayedOrigin: origin,
    originMode: "gps",
    target: "destination",
    query: "Destino",
    showLanes: true,
    search: { suggestions: [] },
    lanes: { data: infrastructure },
    planner: {
      destination,
      route: fast,
      alternatives: result(),
      selectedRouteMode: "fast",
      optionStates: { fast: { status: "ready" } },
      optionsOpen: true,
    },
    begin() {},
  };
  const find = (tree, type) =>
    !tree || typeof tree !== "object"
      ? []
      : Array.isArray(tree)
        ? tree.flatMap((t) => find(t, type))
        : [
            ...(tree.type === type ? [tree] : []),
            ...find(tree.props?.children, type),
          ];
  const first = component.PlannerLayout({ controller: c }),
    map = find(first, "NativeMap")[0];
  c.planner = {
    ...c.planner,
    route: cyclist,
    selectedRouteMode: "cycleway_priority",
    optionStates: { cycleway_priority: { status: "ready" } },
    optionsOpen: false,
  };
  const second = component.PlannerLayout({ controller: c }),
    updated = find(second, "NativeMap")[0];
  assert.equal(map.type, updated.type);
  assert.equal(map.key, updated.key);
  assert.equal(updated.props.geometry, cyclist.geometry);
  assert.equal(updated.props.infrastructure, infrastructure);
  assert.equal(find(second, "RouteSelector")[0].props.visible, false);
  assert.equal(find(second, "RouteSelector")[0].props.selected, cyclist);
});
