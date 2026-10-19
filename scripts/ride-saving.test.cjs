const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    Date,
    Error,
    require: (name) => {
      if (name.endsWith("/ThemeContext"))
        return {
          useThemeColors: () => ({}),
          useThemedStyles: (factory) => factory({}),
        };
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const names = load("apps/mobile/src/modules/rides/utils/ride-name.ts");
const mappers = load("apps/mobile/src/shared/supabase/mappers.ts");
const ended = new Date(2026, 9, 16, 17, 30).toISOString();
const input = {
  title: "",
  destinationName: "Parque Kennedy",
  routeId: null,
  distanceKm: 4.5,
  durationSec: 900,
  startedAt: new Date(2026, 9, 16, 17).toISOString(),
  endedAt: ended,
  coordinates: [
    { latitude: -12, longitude: -77 },
    { latitude: -12.01, longitude: -77.01 },
  ],
};
test("ride names include destination, local arrival date and each time-of-day boundary", () => {
  for (const [hour, expected] of [
    [0, "Madrugada"],
    [5, "Madrugada"],
    [6, "Mañana"],
    [11, "Mañana"],
    [12, "Tarde"],
    [18, "Tarde"],
    [19, "Noche"],
    [23, "Noche"],
  ]) {
    assert.equal(
      names.automaticRideName(
        "Parque Kennedy",
        new Date(2026, 9, 16, hour).toISOString(),
      ),
      `Parque Kennedy · 16/10/2026 · ${expected}`,
    );
  }
});
test("custom ride names are trimmed, blank names use a real fallback and long names are bounded", () => {
  assert.equal(
    names.savedRideName("  Mi vuelta  ", "Parque", ended),
    "Mi vuelta",
  );
  assert.equal(
    names.savedRideName("  ", null, ended),
    "Recorrido libre · 16/10/2026 · Tarde",
  );
  assert.equal(names.automaticRideName("x".repeat(400), ended).length, 160);
  const emojiName = names.automaticRideName("🚴".repeat(200), ended);
  assert.ok(emojiName.length <= 160);
  assert.ok(!/[\uD800-\uDBFF] ·/.test(emojiName));
  assert.throws(() => names.savedRideName("x".repeat(161), null, ended));
});
test("old unnamed rows keep working while named rows preserve both their title and destination", () => {
  const row = {
    id: "ride",
    route_id: null,
    distance_km: 2,
    duration_sec: 100,
    started_at: ended,
    ended_at: ended,
  };
  assert.equal(
    names.rideDisplayName(mappers.rideFromRow(row)),
    "Recorrido libre · 16/10/2026 · Tarde",
  );
  const ride = mappers.rideFromRow({
    ...row,
    title: "Mi salida",
    destination_name: "El Olivar",
  });
  assert.equal(names.rideDisplayName(ride), "Mi salida");
  assert.equal(ride.destinationName, "El Olivar");
});
function serviceWith(rpc) {
  return load("apps/mobile/src/modules/rides/services/rides.service.ts", {
    "../utils/ride-name": names,
    "../../../shared/supabase/client": { getSupabase: () => ({ rpc }) },
    "../../../shared/supabase/mappers": mappers,
  }).ridesService;
}
test("ride saving sends the name and geometry through one atomic RPC", async () => {
  let call;
  const result = await serviceWith(async (name, args) => {
    call = { name, args };
    return { data: "ride-id", error: null };
  }).create(input);
  assert.equal(call.name, "save_planned_ride");
  assert.equal(call.args.p_title, "Parque Kennedy · 16/10/2026 · Tarde");
  assert.equal(call.args.p_destination_name, "Parque Kennedy");
  assert.equal(call.args.p_track.coordinates[0][0], -77);
  assert.equal(result.id, "ride-id");
});
test("missing database migration fails clearly and never silently saves an unnamed ride", async () => {
  const calls = [];
  const service = serviceWith(async (name) => {
    calls.push(name);
    return { data: null, error: { code: "PGRST202" } };
  });
  await assert.rejects(service.create(input), /202610160003_ride_names/);
  assert.deepEqual(calls, ["save_planned_ride"]);
});
function hooks() {
  const cells = [];
  let cursor = 0;
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = initial;
        return [
          cells[i],
          (value) => {
            cells[i] = typeof value === "function" ? value(cells[i]) : value;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = { current: initial };
        return cells[i];
      },
      useEffect() {},
    },
    render(fn) {
      cursor = 0;
      return fn();
    },
  };
}
test("finishing captures the destination once and preserves the stopped ride and title across a failed save", async () => {
  const runtime = hooks(),
    calls = [];
  const originalRoute = {
    distanceMeters: 4500,
    durationSeconds: 900,
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [-77, -12],
          [-77.01, -12.01],
        ],
        [
          [-77.02, -12.02],
          [-77.03, -12.03],
        ],
      ],
    },
  };
  let plan = {
      destination: {
        label: "Destino original",
        coordinate: input.coordinates[1],
      },
      route: originalRoute,
    },
    fail = true,
    photoFail = false,
    photoCalls = 0;
  const tracker = {
    active: false,
    started: null,
    ready: true,
    lastFix: null,
    plan: null,
    savedRideId: null,
    async markSaved(id) {
      this.savedRideId = id;
    },
    async clear() {
      this.started = null;
    },
    start(fix, currentPlan) {
      this.plan = currentPlan;
      this.active = true;
      this.started = input.startedAt;
      return true;
    },
    stop() {
      this.active = false;
      return { ...input, startedAt: input.startedAt, plan: this.plan };
    },
  };
  const { useRideController } = load(
    "apps/mobile/src/modules/rides/hooks/useRideController.ts",
    {
      react: runtime.react,
      "react-native": { Alert: { alert() {} } },
      "expo-router": { router: {}, useLocalSearchParams: () => ({}) },
      "../../navigation/services/planned-ride.store": {
        usePlannedRide: () => plan,
      },
      "./useRideTracker": { useRideTracker: () => tracker },
      "../services/rides.service": {
        ridesService: {
          async create(value) {
            calls.push(value);
            if (fail) throw new Error("offline");
            return { id: "saved" };
          },
        },
      },
      "../services/ride-photos.service": {
        ridePhotosService: {
          upload: async () => {
            photoCalls++;
            if (photoFail) throw new Error("photo offline");
          },
        },
      },
      "../utils/ride-name": names,
      "../../auth/context/AuthContext": {
        useAuth: () => ({ user: { id: "owner" } }),
      },
      "../../geolocation/hooks/useUserLocation": {
        useUserLocation: () => ({ focused: true, fix: {} }),
      },
      "../../geolocation/utils/location-policy": {
        canRecordFix: () => true,
        isFreshFix: (fix) => !!fix,
      },
    },
  );
  const render = () => runtime.render(useRideController);
  let value = render();
  await value.startRecording();
  plan = { destination: { label: "Changed after starting" } };
  value = render();
  await value.finish();
  value = render();
  assert.equal(value.saveDialogOpen, true);
  assert.match(value.automaticName, /^Destino original/);
  value.setRideName("Mi paseo");
  value = render();
  await value.saveRide();
  value = render();
  assert.equal(value.saveError, "offline");
  assert.equal(value.rideName, "Mi paseo");
  assert.equal(value.saved, false);
  value.closeSaveDialog();
  value = render();
  await value.finish();
  value = render();
  assert.equal(value.rideName, "Mi paseo");
  fail = false;
  photoFail = true;
  await Promise.all([value.saveRide(), value.saveRide()]);
  value = render();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].endedAt, calls[1].endedAt);
  assert.equal(calls[1].destinationName, "Destino original");
  assert.equal(calls[1].title, "Mi paseo");
  assert.equal(value.saved, false);
  assert.equal(value.rideAlreadySaved, true);
  assert.equal(value.saveError, "photo offline");
  photoFail = false;
  await value.saveRide();
  value = render();
  assert.equal(
    calls.length,
    2,
    "photo retry must never create a duplicate ride",
  );
  assert.equal(photoCalls, 2);
  assert.equal(calls[1].plannedRoute, originalRoute);
  assert.equal(calls[1].destination, input.coordinates[1]);
  assert.equal(value.saved, true);
  assert.equal(value.saveDialogOpen, false);
});
test("expanding the ride map preserves its React parent and key instead of remounting it", () => {
  let mode = false,
    states = 0;
  const createElement = (type, props, ...children) => ({
    type,
    key: props?.key ?? null,
    children,
  });
  const react = {
    createElement,
    useState: (initial) => [states++ === 0 ? mode : initial, () => {}],
    useRef: () => ({ current: null }),
    useEffect() {},
  };
  const native = Object.fromEntries(
    ["Alert", "Pressable", "ScrollView", "View"].map((name) => [name, name]),
  );
  native.StyleSheet = { create: (value) => value };
  native.useWindowDimensions = () => ({ width: 390, height: 844 });
  const { RideLayout } = load(
    "apps/mobile/src/modules/rides/components/RideLayout.tsx",
    {
      react,
      "react-native": native,
      "@expo/vector-icons": { Ionicons: "Icon" },
      "./SaveRideDialog": { SaveRideDialog: "SaveDialog" },
      "../../navigation/hooks/useLiveNavigation": {
        useLiveNavigation: () => ({ lanes: {}, progress: null }),
      },
      "../../navigation/components/LiveNavigationPanel": {
        LiveNavigationPanel: "NavigationPanel",
      },
      "../../navigation/utils/live-navigation": { distanceLabel: String },
      "../../maps/components/CyclingMap": { CyclingMap: "NativeMap" },
      "../../geolocation/utils/location-policy": {
        canRecordFix: () => true,
        isFreshFix: (fix) => !!fix,
      },
      "../../../shared/components/DesignSystem": Object.fromEntries(
        ["AppText", "Chip", "IconButton", "MetricTile", "ScreenHeader"].map(
          (name) => [name, name],
        ),
      ),
      "../../../shared/components/UI": {
        Notice: "Notice",
        PrimaryButton: "Button",
      },
      "../../../shared/theme/colors": { colors: {} },
    },
  );
  const controller = {
    gps: { fix: null, status: "ready" },
    tracker: { seconds: 0, km: 0, points: [], active: false },
    plan: null,
  };
  function pathToMap(node, path = "") {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node))
      return node.flatMap((child, index) =>
        pathToMap(child, `${path}/${index}`),
      );
    const current = `${path}/${node.type}:${node.key ?? ""}`;
    return node.type === "NativeMap"
      ? [current]
      : pathToMap(node.children, current);
  }
  states = 0;
  const normal = pathToMap(RideLayout({ controller }));
  mode = true;
  states = 0;
  const expanded = pathToMap(RideLayout({ controller }));
  assert.equal(normal.length, 1);
  assert.deepEqual(expanded, normal);
});
