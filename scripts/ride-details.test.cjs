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
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    require(name) {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
    ...globals,
  });
  return exports;
}
const geometry = load("apps/mobile/src/modules/maps/utils/geometry.ts");
const mappers = load("apps/mobile/src/shared/supabase/mappers.ts");
test("short and stationary recordings retain street context and include the entire planned route", () => {
  const bounds = geometry.contextBounds([
    [-77, -12],
    [-77.000001, -12.000001],
  ]);
  assert.ok(bounds[2] - bounds[0] >= 0.003);
  assert.ok(bounds[3] - bounds[1] >= 0.00299);
  const full = geometry.contextBounds([
    [-77, -12],
    [-77.1, -12.1],
    [-76.99, -11.99],
  ]);
  assert.ok(full[0] <= -77.1 && full[2] >= -76.99 && full[1] <= -12.1);
  assert.equal(geometry.contextBounds([]), null);
});
test("history preserves disconnected route legs and GPS stop without inventing a planned route in legacy records", () => {
  const plan = {
    distanceMeters: 500,
    durationSeconds: 120,
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
  const row = {
    id: "ride",
    distance_km: 0.1,
    duration_sec: 60,
    planned_route: plan,
    destination: { latitude: -12.03, longitude: -77.03 },
    stop_position: { latitude: -12.01, longitude: -77.01 },
    completion_status: "incomplete",
  };
  const ride = mappers.rideFromRow(row);
  assert.equal(ride.plannedRoute, plan);
  assert.equal(ride.completionStatus, "incomplete");
  assert.equal(ride.stopPosition.latitude, -12.01);
  assert.equal(mappers.rideFromRow({ id: "legacy" }).plannedRoute, null);
  assert.equal(
    mappers.rideFromRow({ id: "legacy" }).completionStatus,
    "unknown",
  );
  assert.equal(
    mappers.asPlannedRoute({
      ...plan,
      geometry: {
        type: "LineString",
        coordinates: [
          [-77, Infinity],
          [-77, -12],
        ],
      },
    }),
    null,
  );
});
function mapCaller(client, globals) {
  return load(
    "apps/mobile/src/shared/services/map-functions.ts",
    { "../supabase/client": { getSupabase: () => client } },
    globals,
  ).callMapFunction;
}
const session = {
  data: { session: { access_token: "test-token" } },
  error: null,
};
test("map timeout covers a stuck session and a stuck network request, not just fetch cancellation", async () => {
  for (const stuck of ["auth", "network"]) {
    let timer,
      invoked = 0;
    const client = {
      auth: {
        getSession: () =>
          stuck === "auth" ? new Promise(() => {}) : Promise.resolve(session),
      },
      functions: {
        invoke: () => {
          invoked++;
          return new Promise(() => {});
        },
      },
    };
    const call = mapCaller(client, {
      setTimeout(callback, ms) {
        assert.equal(ms, 35000);
        timer = callback;
        return 1;
      },
      clearTimeout() {},
    });
    const request = call("get-bike-lanes", {});
    await new Promise((resolve) => setImmediate(resolve));
    timer();
    await assert.rejects(request, /tardó demasiado.*ciclovías/);
    assert.equal(invoked, stuck === "auth" ? 0 : 1);
  }
});
test("map errors distinguish session, quotas, HTTP failures and each operation", async () => {
  for (const [status, message] of [
    [401, /sesión caducó/],
    [429, /límite temporal/],
    [503, /mantenimiento/],
  ]) {
    const call = mapCaller({
      auth: { getSession: async () => session },
      functions: {
        invoke: async () => ({
          data: null,
          error: {
            context: new Response(JSON.stringify({ error: "mantenimiento" }), {
              status,
            }),
          },
        }),
      },
    });
    await assert.rejects(call("search-destinations", {}), message);
  }
  const call = mapCaller({
    auth: { getSession: async () => session },
    functions: {
      invoke: async () => ({
        error: { context: new TypeError("private network diagnostics") },
      }),
    },
  });
  await assert.rejects(
    call("get-bike-lanes", {}),
    /conectar para consultar las ciclovías/,
  );
  await assert.rejects(
    call("search-destinations", {}),
    /conectar para buscar destinos/,
  );
});
test("cancelled map queries never invoke the Edge Function", async () => {
  let invokes = 0;
  const call = mapCaller({
    auth: { getSession: async () => session },
    functions: {
      invoke: async () => {
        invokes++;
      },
    },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    call("search-destinations", {}, controller.signal),
    /cancelada/,
  );
  assert.equal(invokes, 0);
});
function photoService(storage, options = {}) {
  return load("apps/mobile/src/modules/rides/services/ride-photos.service.ts", {
    "../../../shared/supabase/client": {
      getSupabase: () => ({
        auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        storage: {
          from(bucket) {
            assert.equal(bucket, "ride-photos");
            return storage;
          },
        },
      }),
    },
    "expo-file-system": {
      File: class {
        async arrayBuffer() {
          return new ArrayBuffer(options.size ?? 10);
        }
      },
    },
    "expo-image-picker": {
      launchImageLibraryAsync: async () =>
        options.selection ?? { canceled: true },
    },
  });
}
test("partial photo upload retries only missing files in the owner/ride folder using ArrayBuffers", async () => {
  let fail = true;
  const calls = [];
  const { ridePhotosService } = photoService({
    upload: async (path, bytes, options) => {
      calls.push(path);
      assert.ok(bytes instanceof ArrayBuffer);
      assert.equal(options.upsert, true);
      return {
        error: path.endsWith("two.jpg") && fail ? { message: "offline" } : null,
      };
    },
  });
  const photos = ["one", "two"].map((id) => ({
      id,
      uri: `file://${id}`,
      mime: "image/jpeg",
      extension: "jpg",
    })),
    uploaded = new Set();
  await assert.rejects(
    ridePhotosService.upload("ride", photos, uploaded),
    /offline/,
  );
  assert.deepEqual([...uploaded], ["one"]);
  fail = false;
  await ridePhotosService.upload("ride", photos, uploaded);
  assert.deepEqual(calls, [
    "owner/ride/one.jpg",
    "owner/ride/two.jpg",
    "owner/ride/two.jpg",
  ]);
});
test("private gallery uses temporary signed URLs and handles an empty gallery", async () => {
  const { ridePhotosService } = photoService({
    list: async (prefix) => {
      assert.equal(prefix, "owner/ride");
      return { data: [{ id: "file", name: "photo.jpg" }] };
    },
    createSignedUrls: async (paths, seconds) => {
      assert.equal(seconds, 3600);
      assert.equal(paths[0], "owner/ride/photo.jpg");
      return {
        data: [{ path: paths[0], signedUrl: "https://example.test/temporary" }],
      };
    },
  });
  assert.equal(
    (await ridePhotosService.list("ride"))[0].url,
    "https://example.test/temporary",
  );
  const empty = photoService({ list: async () => ({ data: [] }) });
  assert.equal((await empty.ridePhotosService.list("ride")).length, 0);
});
test("photos reject unsupported formats, oversized files, and uploading an empty file", async () => {
  const picker = photoService(
    {},
    {
      selection: {
        canceled: false,
        assets: [{ uri: "file://photo", mimeType: "image/heic" }],
      },
    },
  );
  await assert.rejects(picker.pickRidePhotos(), /JPG, PNG o WebP/);
  const large = photoService(
    {},
    {
      selection: {
        canceled: false,
        assets: [
          {
            uri: "file://photo",
            mimeType: "image/jpeg",
            fileSize: 6 * 1024 * 1024,
          },
        ],
      },
    },
  );
  await assert.rejects(large.pickRidePhotos(), /máximo 5 MB/);
  const empty = photoService({}, { size: 0 });
  await assert.rejects(
    empty.ridePhotosService.upload("ride", [
      { id: "file", uri: "file://photo" },
    ]),
    /entre 1 byte y 5 MB/,
  );
});
