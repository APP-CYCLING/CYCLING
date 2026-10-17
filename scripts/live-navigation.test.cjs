const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(path, modules = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(resolve(__dirname, "..", path), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    Error,
    Date,
    Set,
    AbortController,
    require(name) {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    ...globals,
  });
  return exports;
}
const engine = load(
  "apps/mobile/src/modules/navigation/utils/live-navigation.ts",
);
const domain = load("supabase/functions/_shared/domain.ts");
const route = () => ({
  distanceMeters: 334,
  durationSeconds: 90,
  geometry: {
    type: "LineString",
    coordinates: [
      [0, 0],
      [0, 0.0015],
      [0.0015, 0.0015],
    ],
  },
  steps: [
    {
      legIndex: 0,
      fromIndex: 0,
      toIndex: 1,
      maneuver: "StartAt",
      instruction: "Comienza en Calle A",
      streetName: "Calle A",
    },
    {
      legIndex: 0,
      fromIndex: 1,
      toIndex: 2,
      maneuver: "Right",
      instruction: "Gira a la derecha hacia Calle B",
      streetName: "Calle B",
    },
    {
      legIndex: 0,
      fromIndex: 2,
      toIndex: 2,
      maneuver: "DestinationReached",
      instruction: "Has llegado al destino",
      streetName: "Calle B",
    },
  ],
});
test("routing retains Spanish maneuvers and road names with indices local to each leg", () => {
  const result = domain.normalizeRoute({
    features: [
      {
        geometry: route().geometry,
        properties: {
          distance: 334,
          time: 90,
          legs: [
            {
              steps: [
                {
                  from_index: 0,
                  to_index: 1,
                  name: "Calle A",
                  instruction: { type: "StartAt", text: "Comienza en Calle A" },
                },
                {
                  from_index: 1,
                  to_index: 2,
                  name: "Calle B",
                  instruction: { type: "Right", text: "Gira a la derecha" },
                },
                {
                  from_index: 99,
                  to_index: 100,
                  instruction: { text: "invalid" },
                },
              ],
            },
          ],
        },
      },
    ],
  });
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[1].streetName, "Calle B");
  assert.equal(result.steps[1].maneuver, "Right");
  assert.equal(result.steps[1].fromIndex, 1);
  const noSteps = domain.normalizeRoute({
    features: [
      { geometry: route().geometry, properties: { distance: 334, time: 90 } },
    ],
  });
  assert.equal(noSteps.steps.length, 0);
});
test("reverse lookup only returns provider street and locality; empty or unnamed results remain unnamed", () => {
  assert.equal(
    domain.normalizeStreet({
      features: [
        {
          properties: {
            street: "Av. Larco",
            city: "Lima",
            formatted: "not a street",
          },
        },
      ],
    }).street,
    "Av. Larco",
  );
  assert.equal(domain.normalizeStreet({ features: [] }).street, null);
  assert.equal(
    domain.normalizeStreet({
      features: [{ properties: { formatted: "Unknown" } }],
    }).street,
    null,
  );
});
test("live progress measures along the road, updates current street and gives distance to the next turn", () => {
  const model = engine.buildNavigation(route());
  const first = engine.locateOnRoute(
    model,
    { latitude: 0.0003, longitude: 0 },
    null,
  );
  assert.ok(first.toManeuver > 130 && first.toManeuver < 135);
  assert.equal(first.currentStep.streetName, "Calle A");
  assert.equal(first.nextStep.maneuver, "Right");
  const after = engine.locateOnRoute(
    model,
    { latitude: 0.0015, longitude: 0.0003 },
    first.progress,
    150,
  );
  assert.equal(after.currentStep.streetName, "Calle B");
  assert.equal(after.nextStep.maneuver, "DestinationReached");
  assert.ok(after.remaining < first.remaining);
});
test("multi-leg progress never includes a fictional straight segment across gaps", () => {
  const model = engine.buildNavigation({
    ...route(),
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [0, 0],
          [0, 0.001],
        ],
        [
          [1, 1],
          [1, 1.001],
        ],
      ],
    },
    steps: [],
  });
  assert.equal(model.segments.length, 2);
  assert.ok(model.total > 220 && model.total < 224);
  assert.equal(model.segments[1].a.longitude, 1);
  const between = engine.locateOnRoute(
    model,
    { latitude: 0.5, longitude: 0.5 },
    null,
  );
  assert.ok(between.distance > 50000);
});
test("closed loops do not jump from start to arrival, nor back to the beginning on the final lap", () => {
  const model = engine.buildNavigation({
    ...route(),
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
        [0, 0.001],
        [0, 0],
      ],
    },
    steps: [],
  });
  const first = engine.locateOnRoute(
    model,
    { latitude: 0, longitude: 0 },
    null,
  );
  assert.equal(first.progress, 0);
  const last = engine.locateOnRoute(
    model,
    { latitude: 0.00005, longitude: 0 },
    model.total - 50,
    50,
  );
  assert.ok(last.remaining < 10);
  assert.ok(last.progress > model.total - 10);
});
test("a crossing near a future section cannot skip hundreds of metres of route", () => {
  const model = engine.buildNavigation({
    ...route(),
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0.003, 0],
        [0.003, 0.003],
        [0, 0.003],
        [0, 0],
      ],
    },
    steps: [],
  });
  const hit = engine.locateOnRoute(
    model,
    { latitude: 0.00001, longitude: 0 },
    0,
    1,
  );
  assert.ok(hit.progress < 5);
  assert.ok(hit.remaining > 1000);
});
test("nearby OSM infrastructure is named only within 20 metres, with no invented lane designation", () => {
  const lanes = {
    type: "FeatureCollection",
    features: [
      {
        geometry: {
          coordinates: [
            [0, 0],
            [0, 0.002],
          ],
        },
        properties: { name: "Ciclovía A", kind: "track" },
      },
    ],
  };
  assert.equal(
    engine.nearestCycleway({ latitude: 0.001, longitude: 0.00005 }, lanes).name,
    "Ciclovía A",
  );
  assert.equal(
    engine.nearestCycleway({ latitude: 0.001, longitude: 0.001 }, lanes),
    null,
  );
});
function runtime() {
  const cells = [],
    effects = [];
  let cursor = 0;
  const changed = (a, b) =>
    !a || a.length !== b.length || a.some((x, i) => x !== b[i]);
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in cells))
          cells[i] = typeof initial === "function" ? initial() : initial;
        return [
          cells[i],
          (v) => {
            cells[i] = typeof v === "function" ? v(cells[i]) : v;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = { current: initial };
        return cells[i];
      },
      useMemo(fn, deps) {
        const i = cursor++;
        if (changed(cells[i]?.deps, deps)) cells[i] = { deps, value: fn() };
        return cells[i].value;
      },
      useEffect(fn, deps) {
        const i = cursor++;
        if (changed(cells[i]?.deps, deps)) {
          const prior = cells[i];
          cells[i] = { deps };
          effects.push(() => {
            prior?.cleanup?.();
            cells[i].cleanup = fn();
          });
        }
      },
    },
    render(fn) {
      cursor = 0;
      const value = fn();
      while (effects.length) effects.shift()();
      return value;
    },
    cleanup() {
      cells.forEach((c) => c?.cleanup?.());
    },
  };
}
function navigationHarness(
  initialPlan = {
    route: route(),
    destination: {
      coordinate: { latitude: 0.0015, longitude: 0.0015 },
      label: "Destino",
    },
  },
  lookupStreet = null,
) {
  const hooks = runtime(),
    spoken = [],
    clock = { now: 1000000 },
    requests = [];
  class Clock extends Date {
    static now() {
      return clock.now;
    }
  }
  const policy = load(
    "apps/mobile/src/modules/geolocation/utils/location-policy.ts",
    {},
    { Date: Clock },
  );
  let fix = {
      coordinate: { latitude: 0, longitude: 0 },
      accuracy: 8,
      timestamp: clock.now,
    },
    enabled = true;
  const plan = initialPlan;
  const { useLiveNavigation } = load(
    "apps/mobile/src/modules/navigation/hooks/useLiveNavigation.ts",
    {
      react: hooks.react,
      "../../geolocation/utils/location-policy": policy,
      "../../bike-lanes/hooks/useVisibleBikeLanes": {
        useVisibleBikeLanes: () => ({
          data: { type: "FeatureCollection", features: [] },
        }),
      },
      "../../route-planner/services/planner.service": {
        plannerService: {
          calculate: async (...args) => {
            requests.push(args);
            return route();
          },
        },
      },
      "../../../shared/services/map-functions": {
        callMapFunction: async () => ({ street: lookupStreet }),
      },
      "../services/navigation-audio.service": {
        announce: async (text) => {
          spoken.push(text);
        },
        stopAnnouncements() {},
      },
      "../utils/live-navigation": engine,
      "expo-keep-awake": {
        activateKeepAwakeAsync: async () => {},
        deactivateKeepAwake: async () => {},
      },
    },
    { Date: Clock },
  );
  const render = () =>
    hooks.render(() => useLiveNavigation(plan, fix, enabled, "owner"));
  return {
    render,
    spoken,
    requests,
    clock,
    move(latitude, longitude, accuracy = 8) {
      clock.now += 3000;
      fix = {
        coordinate: { latitude, longitude },
        accuracy,
        timestamp: clock.now,
      };
      return render();
    },
    stop() {
      enabled = false;
      return render();
    },
    cleanup: hooks.cleanup,
  };
}
test("voice is opt-in, announces each approach once and stops with stale or inaccurate GPS", () => {
  const h = navigationHarness();
  let n = h.render();
  assert.equal(h.spoken.length, 0);
  n.toggleVoice();
  n = h.render();
  assert.equal(h.spoken.length, 0);
  n = h.move(0.0003, 0);
  assert.equal(h.spoken.length, 1);
  assert.match(h.spoken[0], /En 130 metros/);
  n = h.move(0.0005, 0);
  assert.equal(h.spoken.length, 1);
  n = h.move(0.0013, 0);
  assert.equal(h.spoken.length, 2);
  assert.match(h.spoken[1], /^En 20 metros/);
  n = h.move(0.0014, 0, 100);
  assert.equal(n.ready, false);
  assert.equal(h.spoken.length, 2);
  h.clock.now += 15000;
  n = h.render();
  assert.equal(n.precise, false);
  h.stop();
  h.cleanup();
});
test("off-route warning needs three precise fixes and rerouting uses the live origin", async () => {
  const h = navigationHarness();
  let n = h.render();
  n.toggleVoice();
  h.render();
  n = h.move(0, 0.001);
  assert.equal(n.offRoute, false);
  n = h.move(0.00001, 0.001);
  assert.equal(n.offRoute, false);
  n = h.move(0.00002, 0.001);
  assert.equal(n.offRoute, true);
  assert.match(h.spoken.at(-1), /alejado de la ruta/);
  await n.recalculate();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0][0].latitude, 0.00002);
  assert.equal(h.requests[0][0].longitude, 0.001);
  assert.equal(h.requests[0][1].latitude, 0.0015);
  h.stop();
  h.cleanup();
});
test("a free ride has live tracking but invents neither turns nor a destination", () => {
  const h = navigationHarness(null);
  let n = h.render();
  assert.equal(n.ready, true);
  assert.equal(n.route, undefined);
  assert.equal(n.progress, null);
  n.toggleVoice();
  h.render();
  h.move(0.0003, 0);
  assert.equal(h.spoken.length, 0);
  h.stop();
  h.cleanup();
});
test("free-ride voice reads a provider street once without inventing a turn", async () => {
  const h = navigationHarness(null, "Av. Larco");
  let n = h.render();
  n.toggleVoice();
  await new Promise((resolve) => setImmediate(resolve));
  n = h.render();
  assert.equal(n.streetName, "Av. Larco");
  assert.deepEqual(h.spoken, ["Estás cerca de Av. Larco."]);
  h.move(0.0002, 0);
  assert.equal(h.spoken.length, 1);
  h.stop();
  h.cleanup();
});
test("a meaningful retreat is detected while minor GPS jitter never counts as backtracking", () => {
  const model = engine.buildNavigation(route());
  assert.equal(
    engine.locateOnRoute(model, { latitude: 0.0008, longitude: 0 }, 100, 12)
      .backtracking,
    false,
  );
  assert.equal(
    engine.locateOnRoute(model, { latitude: 0.0003, longitude: 0 }, 100, 70)
      .backtracking,
    true,
  );
});
test("arrival on a circular route requires travelling the loop rather than just standing at its destination", () => {
  const loop = {
    ...route(),
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
        [0, 0.001],
        [0, 0],
      ],
    },
    steps: [],
  };
  const h = navigationHarness({
    route: loop,
    destination: {
      coordinate: { latitude: 0, longitude: 0 },
      label: "Inicio y destino",
    },
  });
  assert.equal(h.render().arrived, false);
  h.move(0, 0.001);
  h.move(0.001, 0.001);
  h.move(0.001, 0);
  assert.equal(h.move(0, 0).arrived, true);
  h.stop();
  h.cleanup();
});
