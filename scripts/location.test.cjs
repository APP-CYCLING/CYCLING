const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

function load(file, modules = {}) {
  const exports = {};
  const compiled = ts.transpileModule(
    readFileSync(resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(compiled, {
    exports,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    require: (name) => {
      if (!(name in modules)) throw Error(`Unexpected dependency ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const policy = load(
  "apps/mobile/src/modules/geolocation/utils/location-policy.ts",
);
const { startLocationSession } = load(
  "apps/mobile/src/modules/geolocation/services/location-session.ts",
  { "../utils/location-policy": policy },
);
const pending = () => new Promise(() => {});
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
function clock() {
  let now = 1000000,
    id = 0;
  const tasks = new Map();
  return {
    now: () => now,
    later: (fn, ms) => {
      tasks.set(++id, { fn, at: now + ms, period: 0 });
      return id;
    },
    repeat: (fn, ms) => {
      tasks.set(++id, { fn, at: now + ms, period: ms });
      return id;
    },
    cancelLater: (id) => tasks.delete(id),
    cancelRepeat: (id) => tasks.delete(id),
    advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...tasks]
          .filter(([, v]) => v.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [key, task] = next;
        now = task.at;
        if (task.period) task.at += task.period;
        else tasks.delete(key);
        task.fn();
      }
      now = target;
    },
    count: () => tasks.size,
  };
}
const reading = (time, accuracy = 20, longitude = 35) => ({
  coords: { latitude: 12, longitude, accuracy },
  timestamp: time,
});
function provider(overrides = {}) {
  return {
    permission: async () => ({ granted: true, canAskAgain: true }),
    servicesEnabled: async () => true,
    lastKnown: async () => null,
    current: pending,
    watch: async () => ({ remove() {} }),
    ...overrides,
  };
}

test("location timeout covers a stuck permission dialog and prevents late GPS startup", async () => {
  const time = clock(),
    states = [];
  let resolvePermission,
    watches = 0;
  startLocationSession(
    provider({
      permission: () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
      watch: async () => {
        watches++;
        return { remove() {} };
      },
    }),
    (value) => states.push(value),
    time,
  );
  assert.equal(states.at(-1).loading, true);
  time.advance(20000);
  assert.equal(states.at(-1).status, "timeout");
  assert.equal(states.at(-1).loading, false);
  resolvePermission({ granted: true, canAskAgain: true });
  await flush();
  assert.equal(watches, 0);
  assert.equal(time.count(), 0);
});
test("location timeout also covers stuck services check and watcher initialization", async () => {
  for (const overrides of [{ servicesEnabled: pending }, { watch: pending }]) {
    const time = clock(),
      states = [];
    startLocationSession(
      provider(overrides),
      (value) => states.push(value),
      time,
    );
    await flush();
    time.advance(20000);
    assert.equal(states.at(-1).loading, false);
    assert.equal(states.at(-1).status, "timeout");
    assert.equal(time.count(), 0);
  }
});
test("first current fix centers preview without waiting for a watch event", async () => {
  const time = clock(),
    states = [];
  const stop = startLocationSession(
    provider({ current: async () => reading(time.now(), 45), watch: pending }),
    (value) => states.push(value),
    time,
  );
  await flush();
  assert.equal(states.at(-1).status, "ready");
  assert.equal(states.at(-1).fix.coordinate.longitude, 35);
  assert.equal(states.at(-1).loading, false);
  stop();
});
test("a recent coarse OS fix is shown as approximate, but cannot record cycling distance", async () => {
  const time = clock(),
    states = [];
  const stop = startLocationSession(
    provider({ lastKnown: async () => reading(time.now() - 5000, 1200) }),
    (value) => states.push(value),
    time,
  );
  await flush();
  assert.equal(states.at(-1).status, "approximate");
  assert.equal(states.at(-1).loading, false);
  assert.equal(policy.canRecordFix(states.at(-1).fix, time.now()), false);
  stop();
});
test("stale, invalid or future coordinates never become a fictitious current position", () => {
  const now = 1000000;
  for (const value of [
    reading(now - 31000),
    reading(now + 6000),
    reading(now, 4000),
    { ...reading(now), coords: { latitude: NaN, longitude: 35, accuracy: 10 } },
  ])
    assert.equal(policy.toLocationFix(value, now), null);
  const fix = policy.toLocationFix(reading(now), now);
  assert.ok(policy.canRecordFix(fix, now));
  assert.equal(policy.canRecordFix(fix, now + 11000), false);
});
test("denied permission and disabled services finish loading without opening a watcher", async () => {
  for (const [overrides, expected] of [
    [
      { permission: async () => ({ granted: false, canAskAgain: false }) },
      "denied",
    ],
    [{ servicesEnabled: async () => false }, "disabled"],
  ]) {
    const time = clock(),
      states = [];
    let watches = 0;
    startLocationSession(
      provider({
        ...overrides,
        watch: async () => {
          watches++;
          return { remove() {} };
        },
      }),
      (value) => states.push(value),
      time,
    );
    await flush();
    assert.equal(states.at(-1).status, expected);
    assert.equal(states.at(-1).loading, false);
    assert.equal(watches, 0);
    assert.equal(time.count(), 0);
  }
});
test("leaving screen removes a subscription that resolves after cleanup and ignores late fixes", async () => {
  const time = clock(),
    states = [];
  let finishWatch,
    sendFix,
    removed = 0;
  const stop = startLocationSession(
    provider({
      watch: (callback) => {
        sendFix = callback;
        return new Promise((resolve) => {
          finishWatch = resolve;
        });
      },
    }),
    (value) => states.push(value),
    time,
  );
  await flush();
  stop();
  const count = states.length;
  finishWatch({ remove: () => removed++ });
  sendFix(reading(time.now()));
  await flush();
  assert.equal(removed, 1);
  assert.equal(states.length, count);
  assert.equal(time.count(), 0);
});
test("late cached responses do not displace a newer precise fix and signal loss clears the marker", async () => {
  const time = clock(),
    states = [];
  let finishLast, sendFix;
  const stop = startLocationSession(
    provider({
      lastKnown: () =>
        new Promise((resolve) => {
          finishLast = resolve;
        }),
      watch: async (callback) => {
        sendFix = callback;
        return { remove() {} };
      },
    }),
    (value) => states.push(value),
    time,
  );
  await flush();
  sendFix(reading(time.now(), 15, 35));
  finishLast(reading(time.now() - 5000, 1000, 36));
  await flush();
  assert.equal(states.at(-1).fix.coordinate.longitude, 35);
  time.advance(35000);
  assert.equal(states.at(-1).status, "stale");
  assert.equal(states.at(-1).fix, null);
  assert.equal(states.at(-1).loading, false);
  stop();
});

test("a watcher error does not discard a current-position request still in progress", async () => {
  const time = clock(),
    states = [];
  let finishCurrent;
  const stop = startLocationSession(
    provider({
      current: () =>
        new Promise((resolve) => {
          finishCurrent = resolve;
        }),
      watch: async () => {
        throw Error("Native watcher unavailable");
      },
    }),
    (value) => states.push(value),
    time,
  );
  await flush();
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).status, "error");
  finishCurrent(reading(time.now(), 30));
  await flush();
  assert.equal(states.at(-1).status, "ready");
  assert.equal(states.at(-1).fix.coordinate.longitude, 35);
  stop();
});

function hooks() {
  const cells = [];
  let cursor = 0;
  const cleanup = [];
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = initial;
        return [
          cells[index],
          (value) => {
            cells[index] =
              typeof value === "function" ? value(cells[index]) : value;
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = { current: initial };
        return cells[index];
      },
      useCallback(fn) {
        return fn;
      },
      useEffect(fn) {
        cleanup.push(fn);
      },
    },
    render(fn) {
      cursor = 0;
      return fn();
    },
  };
}
test("routing takes the current GPS origin at confirmation and keeps that origin with its geometry", async () => {
  const runtime = hooks(),
    calls = [];
  let resolveRoute;
  const { useRoutePlanner } = load(
    "apps/mobile/src/modules/route-planner/hooks/useRoutePlanner.ts",
    {
      react: runtime.react,
      "../services/planner.service": {
        plannerService: {
          calculate: (origin, destination) => {
            calls.push({ origin, destination });
            return new Promise((resolve) => {
              resolveRoute = resolve;
            });
          },
        },
      },
    },
  );
  let origin = { latitude: 12, longitude: 35 };
  const render = () => runtime.render(() => useRoutePlanner(origin));
  let value = render();
  value.select({
    id: "destination",
    label: "Test destination",
    coordinate: { latitude: 12.1, longitude: 35.1 },
  });
  origin = { latitude: 12.01, longitude: 35.01 };
  value = render();
  const request = value.calculate();
  assert.equal(calls[0].origin.longitude, 35.01);
  origin = { latitude: 12.02, longitude: 35.02 };
  value = render();
  assert.equal(calls.length, 1);
  assert.equal(value.routeOrigin.longitude, 35.01);
  resolveRoute({
    geometry: {
      type: "LineString",
      coordinates: [
        [35.01, 12.01],
        [35.1, 12.1],
      ],
    },
    distanceMeters: 100,
    durationSeconds: 30,
  });
  await request;
  value = render();
  assert.equal(value.routeOrigin.longitude, 35.01);
  assert.equal(value.route.geometry.coordinates[0][0], 35.01);
});
