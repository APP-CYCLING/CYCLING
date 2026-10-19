const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    Date,
    Error,
    Promise,
    Set,
    require(name) {
      if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const policy = load(
  "apps/mobile/src/modules/geolocation/utils/location-policy.ts",
);
const { RecordingStore } = load(
  "apps/mobile/src/modules/rides/services/recording-store.ts",
  {
    "../../geolocation/utils/location-policy": policy,
  },
);
const base = 1800000000000;
const fix = (timestamp = base, longitude = -77) => ({
  coordinate: { latitude: -12, longitude },
  accuracy: 5,
  timestamp,
});
const reading = (timestamp, longitude, accuracy = 5) => ({
  timestamp,
  coords: { latitude: -12, longitude, accuracy },
});
const plan = {
  userId: "a",
  origin: fix().coordinate,
  destination: {
    label: "Mi destino",
    coordinate: { latitude: -12, longitude: -77.01 },
  },
  route: {
    geometry: {
      type: "LineString",
      coordinates: [
        [-77, -12],
        [-77.01, -12],
      ],
    },
    distanceMeters: 1000,
    durationSeconds: 500,
  },
};
function setup() {
  const data = new Map();
  let now = base,
    running = false,
    deny = false,
    diskError = false,
    starts = 0,
    stops = 0;
  const storage = {
    async getItem(k) {
      return data.get(k) ?? null;
    },
    async setItem(k, v) {
      if (diskError) throw new Error("disk full");
      data.set(k, v);
    },
    async removeItem(k) {
      data.delete(k);
    },
  };
  const native = {
    async requestPermission() {
      if (deny) throw new Error("background permission denied");
    },
    async start() {
      running = true;
      starts++;
    },
    async stop() {
      running = false;
      stops++;
    },
    async isStarted() {
      return running;
    },
  };
  return {
    data,
    storage,
    native,
    store: new RecordingStore(storage, native, () => now),
    newStore: () => new RecordingStore(storage, native, () => now),
    advance(ms) {
      now += ms;
    },
    kill() {
      running = false;
    },
    deny() {
      deny = true;
    },
    diskFail() {
      diskError = true;
    },
    counts: () => ({ starts, stops, running }),
  };
}
test("background batches survive delayed delivery, are ordered and deduplicated without any mounted screen", async () => {
  const f = setup();
  assert.equal(await f.store.start("a", fix(), plan), true);
  f.advance(120000);
  await Promise.all([
    f.store.append([
      reading(base + 6000, -77.0002),
      reading(base + 3000, -77.0001),
    ]),
    f.store.append([
      reading(base + 6000, -77.0002),
      reading(base + 9000, -77.0003),
    ]),
  ]);
  const draft = f.store.getSnapshot().draft;
  assert.equal(draft.points.length, 4);
  assert.ok(draft.km > 0.03 && draft.km < 0.04);
  assert.equal(draft.status, "active");
  assert.equal(f.counts().starts, 1);
});
test("headless restart loads the active draft and preserves plan and every recorded point", async () => {
  const f = setup();
  await f.store.start("a", fix(), plan);
  f.advance(6000);
  await f.store.append([reading(base + 3000, -77.0001)]);
  const headless = f.newStore();
  await headless.append([reading(base + 6000, -77.0002)]);
  const reopened = f.newStore();
  await reopened.restore("a");
  const draft = reopened.getSnapshot().draft;
  assert.equal(draft.status, "active");
  assert.equal(draft.points.length, 3);
  assert.equal(draft.plan.destination.label, "Mi destino");
  assert.equal(
    f.counts().starts,
    1,
    "reopening must not start a second native recorder",
  );
});
test("a killed native service recovers an interrupted draft ending at the last fix, without inventing elapsed time", async () => {
  const f = setup();
  await f.store.start("a", fix(), null);
  f.advance(3000);
  await f.store.append([reading(base + 3000, -77.0001)]);
  f.kill();
  f.advance(600000);
  const reopened = f.newStore();
  await reopened.restore("a");
  const draft = reopened.getSnapshot().draft;
  assert.equal(draft.status, "interrupted");
  assert.equal(draft.endedMs, base + 3000);
  assert.equal(draft.points.length, 2);
  assert.match(reopened.getSnapshot().error, /interrumpió/);
  assert.equal(f.counts().starts, 1);
});
test("finishing stops the native service and ignores subsequent late callbacks", async () => {
  const f = setup();
  await f.store.start("a", fix(), plan);
  f.advance(6000);
  await f.store.append([reading(base + 3000, -77.0001)]);
  const stopped = await f.store.stop("a");
  await f.store.append([reading(base + 6000, -77.0002)]);
  assert.equal(stopped.endedMs, base + 6000);
  assert.equal(f.counts().running, false);
  assert.equal(f.store.getSnapshot().draft.points.length, 2);
  await f.store.clear("a");
  const reopened = f.newStore();
  await reopened.restore("a");
  assert.equal(reopened.getSnapshot().draft, null);
});
test("denied permissions never start the timer, persist a fake ride or start the GPS", async () => {
  const f = setup();
  f.deny();
  assert.equal(await f.store.start("a", fix(), null), false);
  assert.equal(f.store.getSnapshot().draft, null);
  assert.equal(f.store.getSnapshot().busy, false);
  assert.equal(f.counts().starts, 0);
  assert.match(f.store.getSnapshot().error, /permission denied/);
});
test("account switch stops tracking, isolates drafts and recovers the previous account's points", async () => {
  const f = setup();
  await f.store.start("a", fix(), plan);
  await f.store.restore("b");
  assert.equal(f.counts().running, false);
  assert.equal(f.store.getSnapshot().owner, "b");
  assert.equal(f.store.getSnapshot().draft, null);
  await f.store.restore("a");
  assert.equal(f.store.getSnapshot().draft.owner, "a");
  assert.equal(f.store.getSnapshot().draft.status, "interrupted");
  assert.equal(
    f.store.getSnapshot().draft.plan.destination.label,
    "Mi destino",
  );
});
test("GPS noise, duplicate, stale-before-start, future and teleporting samples never inflate distance", async () => {
  const f = setup();
  await f.store.start("a", fix(), null);
  f.advance(3000);
  await f.store.append([
    reading(base - 1000, -77.0001),
    reading(base, -77.0001),
    reading(base + 1000, -77.1),
    reading(base + 2000, -77.0002, 300),
    reading(base + 30000, -77.0003),
    reading(base + 3000, -77.0001),
  ]);
  assert.equal(f.store.getSnapshot().draft.points.length, 2);
  assert.ok(f.store.getSnapshot().draft.km < 0.02);
});
test("native recording does not begin when its draft cannot be persisted", async () => {
  const f = setup();
  f.diskFail();
  assert.equal(await f.store.start("a", fix(), plan), false);
  assert.equal(f.counts().starts, 0);
  assert.match(f.store.getSnapshot().error, /disk full/);
});
test("concurrent starts create exactly one recording and unsaved drafts require explicit discard", async () => {
  const f = setup();
  const result = await Promise.all([
    f.store.start("a", fix(), plan),
    f.store.start("a", fix(), plan),
  ]);
  assert.deepEqual(result, [true, false]);
  await f.store.stop("a");
  assert.equal(await f.store.start("a", fix(), null), false);
  assert.equal(await f.store.start("a", fix(), null, true), true);
  assert.equal(f.store.getSnapshot().draft.plan, null);
});
test("saved server ID survives process recreation so photo retries do not duplicate the ride", async () => {
  const f = setup();
  await f.store.start("a", fix(), plan);
  await f.store.stop("a");
  await f.store.markSaved("a", "server-ride-id");
  const reopened = f.newStore();
  await reopened.restore("a");
  assert.equal(reopened.getSnapshot().draft.savedRideId, "server-ride-id");
});

test("permission dialogs that outlive the seed fix cannot start a ride from an old location", async () => {
  const f = setup();
  f.native.requestPermission = async () => f.advance(60000);
  assert.equal(await f.store.start("a", fix(), null), false);
  assert.equal(f.counts().starts, 0);
  assert.equal(f.store.getSnapshot().draft, null);
  assert.match(f.store.getSnapshot().error, /Permisos listos/);
});

test("partial native startup failure cleans up the service and leaves a recoverable draft", async () => {
  const f = setup();
  const start = f.native.start;
  f.native.start = async () => { await start(); throw new Error("native startup failed"); };
  assert.equal(await f.store.start("a", fix(), plan), false);
  assert.equal(f.counts().running, false);
  assert.equal(f.store.getSnapshot().draft.status, "interrupted");
  assert.match(f.store.getSnapshot().error, /native startup failed/);
});

test("an obsolete account cannot stop the current account's active GPS service", async () => {
  const f = setup();
  await f.store.start("a", fix(), plan);
  await f.store.restore("b");
  await f.store.start("b", fix(), null);
  await assert.rejects(f.store.stop("a"), /otra sesión/);
  assert.equal(f.counts().running, true);
  assert.equal(f.store.getSnapshot().draft.owner, "b");
});
