const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(file, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    Date,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const model = load("apps/mobile/src/modules/profile/utils/profile-model.ts");
const activity = load(
  "apps/mobile/src/modules/rides/utils/activity-summary.ts",
);
const defaults = () => model.profileFromMetadata("Ana", {});
const ride = (id, date, distanceKm, durationSec = 3600) => ({
  id,
  startedAt: date.toISOString(),
  endedAt: date.toISOString(),
  distanceKm,
  durationSec,
  coordinates: [],
  routeId: null,
});

test("profile loads older accounts and malformed optional metadata without invented personal data", () => {
  const profile = model.profileFromMetadata("Ana", {
    cycling_profile: "invalid",
  });
  assert.equal(profile.name, "Ana");
  assert.equal(profile.bio, "");
  assert.equal(profile.location, "");
  assert.equal(profile.weightKg, "");
  const corrupt = model.profileFromMetadata("Ana", {
    cycling_profile: {
      discipline: "flight",
      frequency: 99,
      monthlyGoalKm: 400,
    },
  });
  assert.equal(corrupt.discipline, model.disciplines[0]);
  assert.equal(corrupt.frequency, model.frequencies[0]);
});
test("profile validation handles optional fields, aliases and decimal commas", () => {
  const profile = model.validateProfile({
    ...defaults(),
    name: "  Ana Pérez  ",
    username: "@ana.perez",
    weightKg: "58,5",
    heightCm: "168",
  });
  assert.equal(profile.name, "Ana Pérez");
  assert.equal(profile.username, "ana.perez");
  assert.equal(profile.weightKg, "58.5");
  assert.equal(model.validateProfile(defaults()).weightKg, "");
});
test("profile rejects invalid lengths and non-finite or out-of-range body metrics and goals", () => {
  for (const patch of [
    { name: "A" },
    { username: "bad alias" },
    { bio: "x".repeat(161) },
    { weightKg: "NaN" },
    { weightKg: "19" },
    { heightCm: "251" },
    { monthlyGoalKm: "" },
    { monthlyGoalKm: "10001" },
  ]) {
    assert.throws(() => model.validateProfile({ ...defaults(), ...patch }));
  }
});
function serviceFor(auth) {
  return load("apps/mobile/src/modules/profile/services/profile.service.ts", {
    "../../../shared/supabase/client": { getSupabase: () => ({ auth }) },
    "../utils/profile-model": model,
  }).profileService;
}
test("profile update validates before network and rejects a changed account before writing", async () => {
  let reads = 0,
    writes = 0;
  const service = serviceFor({
    getUser: async () => {
      reads++;
      return {
        data: { user: { id: "other", user_metadata: {} } },
        error: null,
      };
    },
    updateUser: async () => {
      writes++;
    },
  });
  await assert.rejects(service.update("owner", { ...defaults(), name: "" }));
  assert.equal(reads, 0);
  await assert.rejects(service.update("owner", defaults()), /sesión cambió/);
  assert.equal(writes, 0);
});
test("profile updates only own editable metadata and preserves other cycling preferences", async () => {
  let payload;
  const auth = {
    getUser: async () => ({
      data: {
        user: {
          id: "owner",
          user_metadata: { cycling_profile: { futurePreference: true } },
        },
      },
      error: null,
    }),
    updateUser: async (data) => {
      payload = data;
      return {
        data: { user: { id: "owner", user_metadata: data.data } },
        error: null,
      };
    },
  };
  const result = await serviceFor(auth).update("owner", {
    ...defaults(),
    bikeName: "Mi bicicleta",
  });
  assert.deepEqual(Object.keys(payload).sort(), ["data"]);
  assert.equal(payload.data.cycling_profile.futurePreference, true);
  assert.equal(result.bikeName, "Mi bicicleta");
  assert.equal(payload.data.name, "Ana");
});
test("failed profile writes propagate the server error instead of claiming success", async () => {
  const service = serviceFor({
    getUser: async () => ({
      data: { user: { id: "owner", user_metadata: {} } },
      error: null,
    }),
    updateUser: async () => ({
      data: { user: null },
      error: new Error("offline"),
    }),
  });
  await assert.rejects(service.update("owner", defaults()), /offline/);
});
test("activity periods respect local Monday, month and year boundaries and exclude future records", () => {
  const now = new Date(2026, 9, 21, 12);
  const rides = [
    ride("sun", new Date(2026, 9, 18, 23, 59), 1),
    ride("mon", new Date(2026, 9, 19), 2),
    ride("last-month", new Date(2026, 8, 30), 3),
    ride("last-year", new Date(2025, 11, 31), 4),
    ride("future", new Date(2026, 9, 22), 5),
  ];
  assert.equal(
    activity
      .filterRides(rides, "week", now)
      .map((r) => r.id)
      .join(),
    "mon",
  );
  assert.equal(activity.filterRides(rides, "month", now).length, 2);
  assert.equal(activity.filterRides(rides, "year", now).length, 3);
  assert.equal(activity.filterRides(rides, "all", now).length, 4);
});
test("activity computes a weighted average and daily bars without borrowing other weeks", () => {
  const now = new Date(2026, 9, 21, 12);
  const rides = [
    ride("a", new Date(2026, 9, 19, 8), 10, 3600),
    ride("b", new Date(2026, 9, 19, 10), 30, 1800),
    ride("old", new Date(2026, 9, 12), 100),
  ];
  const summary = activity.summarizeRides(rides.slice(0, 2));
  assert.equal(summary.averageKmh, 40 / 1.5);
  assert.equal(summary.durationSec, 5400);
  const days = activity.dailyDistances(rides, now);
  assert.equal(days[0].distance, 40);
  assert.equal(
    days.reduce((sum, day) => sum + day.distance, 0),
    40,
  );
  assert.equal(activity.summarizeRides([]).averageKmh, 0);
});
