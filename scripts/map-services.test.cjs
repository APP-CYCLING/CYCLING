const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

function load(file, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(resolve(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    URL,
    Response,
    Request,
    Headers,
    AbortSignal,
    TextDecoder,
    Uint8Array,
    ...globals,
  });
  return exports;
}
const domain = load("supabase/functions/_shared/domain.ts");
const feature = (geometry) => ({
  features: [{ properties: { distance: 5200, time: 1320 }, geometry }],
});
test("routing preserves every disconnected MultiLineString leg without invented connections", () => {
  const coordinates = [
    [
      [-77, -12],
      [-77.01, -12.01],
    ],
    [
      [-77.02, -12.02],
      [-77.03, -12.03],
    ],
  ];
  const result = domain.normalizeRoute(
    feature({ type: "MultiLineString", coordinates }),
  );
  assert.equal(result.geometry.type, "MultiLineString");
  assert.equal(result.geometry.coordinates.length, 2);
  assert.equal(
    JSON.stringify(result.geometry.coordinates),
    JSON.stringify(coordinates),
  );
  assert.equal(result.distanceMeters, 5200);
  assert.equal(result.durationSeconds, 1320);
});
test("routing accepts LineString and preserves longitude/latitude order", () => {
  const result = domain.normalizeRoute(
    feature({
      type: "LineString",
      coordinates: [
        [-77, -12],
        [-77.1, -12.1],
      ],
    }),
  );
  assert.equal(result.geometry.coordinates[0][0], -77);
  assert.equal(result.geometry.coordinates[0][1], -12);
});
test("rejects invalid coordinates, absent routes, wrong geometry and unreliable metrics", () => {
  for (const value of [
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: "0" },
    null,
  ])
    assert.throws(() => domain.coordinate(value));
  for (const value of [
    { features: [] },
    feature({ type: "Point", coordinates: [0, 0] }),
    feature({
      type: "LineString",
      coordinates: [
        [181, 0],
        [0, 0],
      ],
    }),
    {
      features: [
        {
          properties: { distance: NaN, time: 10 },
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
    },
  ])
    assert.throws(() => domain.normalizeRoute(value));
});
test("geocoding extracts only actual Point results and formatted labels", () => {
  const result = domain.normalizeDestinations({
    features: [
      {
        geometry: { type: "Point", coordinates: [-77, -12] },
        properties: { formatted: "Test result from provider", place_id: "p1" },
      },
    ],
  });
  assert.equal(result[0].coordinate.longitude, -77);
  assert.equal(result[0].coordinate.latitude, -12);
  assert.equal(result[0].id, "p1");
  assert.throws(() =>
    domain.normalizeDestinations({
      features: [
        {
          geometry: { type: "LineString", coordinates: [] },
          properties: { formatted: "Invalid" },
        },
      ],
    }),
  );
});
test("OSM classifications distinguish lanes, shared roads and designated access", () => {
  assert.equal(
    domain.classifyLane({ highway: "residential", bicycle: "yes" }),
    null,
  );
  assert.equal(domain.classifyLane({ highway: "cycleway" }), "cycleway");
  assert.equal(
    domain.classifyLane({ highway: "cycleway", segregated: "no" }),
    "shared",
  );
  assert.equal(domain.classifyLane({ "cycleway:left": "track" }), "track");
  assert.equal(domain.classifyLane({ "cycleway:right": "lane" }), "lane");
  assert.equal(domain.classifyLane({ cycleway: "shared_lane" }), "shared");
  assert.equal(domain.classifyLane({ bicycle: "designated" }), "designated");
  assert.equal(
    domain.classifyLane({ highway: "cycleway", access: "private" }),
    null,
  );
  assert.equal(domain.classifyLane({ cycleway: "lane", bicycle: "no" }), null);
});
test("OSM uses original geometry and rejects partial timeout results", () => {
  const result = domain.normalizeLanes({
    elements: [
      {
        type: "way",
        id: 1,
        tags: { highway: "cycleway" },
        geometry: [
          { lon: -77, lat: -12 },
          { lon: -77.01, lat: -12.01 },
        ],
      },
    ],
  });
  assert.equal(result.features[0].geometry.coordinates[0][0], -77);
  assert.equal(result.features[0].id, "osm-way-1");
  assert.throws(() =>
    domain.normalizeLanes({ remark: "runtime error: timeout", elements: [] }),
  );
});
test("bounds reject world-sized and reversed requests", () => {
  assert.throws(() => domain.boundedArea([-180, -90, 180, 90]));
  assert.throws(() => domain.boundedArea([1, 1, 0, 0]));
  assert.equal(domain.boundedArea([-77.05, -12.05, -77, -12]).length, 4);
});

function endpoint({ validUser = true, quota = true, quotaError = false } = {}) {
  let handler;
  let quotaCalls = 0;
  let upstreamCalls = 0;
  const http = load("supabase/functions/_shared/http.ts", {
    Deno: {
      env: {
        get: (key) =>
          ({
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_ANON_KEY: "public-test-key",
            SUPABASE_SERVICE_ROLE_KEY: "server-test-key",
          })[key],
      },
      serve: (fn) => {
        handler = fn;
      },
    },
    require: (name) =>
      name === "./domain.ts"
        ? domain
        : name.startsWith("npm:")
          ? {
              createClient: () => ({
                auth: {
                  getUser: async () => ({
                    data: { user: validUser ? { id: "test-user" } : null },
                    error: validUser ? null : { message: "invalid" },
                  }),
                },
                rpc: async () => {
                  quotaCalls++;
                  return {
                    data: quota,
                    error: quotaError ? { message: "missing RPC" } : null,
                  };
                },
              }),
            }
          : null,
  });
  http.serve("route", async () => {
    upstreamCalls++;
    return { ok: true };
  });
  return { invoke: handler, counts: () => ({ quotaCalls, upstreamCalls }) };
}
test("Edge rejects missing or invalid user JWT before quota and upstream", async () => {
  const noToken = endpoint();
  assert.equal(
    (
      await noToken.invoke(
        new Request("https://example.test", { method: "POST", body: "{}" }),
      )
    ).status,
    401,
  );
  const badToken = endpoint({ validUser: false });
  assert.equal(
    (
      await badToken.invoke(
        new Request("https://example.test", {
          method: "POST",
          headers: { Authorization: "Bearer invalid-test-token" },
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  assert.equal(badToken.counts().quotaCalls, 0);
  assert.equal(noToken.counts().upstreamCalls, 0);
});
test("Edge fails closed when shared quota is absent or exhausted", async () => {
  for (const [options, status] of [
    [{ quotaError: true }, 503],
    [{ quota: false }, 429],
  ]) {
    const route = endpoint(options);
    const response = await route.invoke(
      new Request("https://example.test", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: "{}",
      }),
    );
    assert.equal(response.status, status);
    assert.equal(route.counts().upstreamCalls, 0);
  }
});
test("Edge validates method, CORS and JSON before running handler", async () => {
  const route = endpoint();
  assert.equal(
    (await route.invoke(new Request("https://example.test"))).status,
    405,
  );
  assert.equal(
    (
      await route.invoke(
        new Request("https://example.test", { method: "OPTIONS" }),
      )
    ).status,
    204,
  );
  const invalid = await route.invoke(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: "{",
    }),
  );
  assert.equal(invalid.status, 400);
  const valid = await route.invoke(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: "{}",
    }),
  );
  assert.equal(valid.status, 200);
  assert.equal(route.counts().upstreamCalls, 1);
});
