const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function load(file, modules = {}, globals = {}) {
  const exports = {},
    context = {
      exports,
      URL,
      Map,
      Set,
      Date,
      Error,
      Promise,
      TextEncoder,
      Uint8Array,
      ArrayBuffer,
      require: (name) => {
        if (!(name in modules))
          throw new Error(`Unexpected dependency ${name}`);
        return modules[name];
      },
      ...globals,
    };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
    context,
  );
  Object.defineProperty(exports, "context", { value: context });
  return exports;
}
const user = "11111111-1111-4111-8111-111111111111",
  uuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function media({
  assets = [],
  cancel = false,
  bytes = 100,
  actualUser = user,
} = {}) {
  let options, upload;
  const service = load("apps/mobile/src/shared/services/media-upload.ts", {
    "../supabase/client": {
      getSupabase: () => ({
        auth: {
          getUser: async () => ({
            data: { user: actualUser ? { id: actualUser } : null },
            error: null,
          }),
        },
        storage: {
          from: () => ({
            upload: async (path, buffer, config) => {
              upload = { path, bytes: buffer.byteLength, config };
              return { error: null };
            },
          }),
        },
      }),
    },
    "expo-crypto": { randomUUID: () => uuid },
    "expo-image-picker": {
      launchImageLibraryAsync: async (opts) => {
        options = opts;
        return { canceled: cancel, assets };
      },
    },
    "expo-file-system": {
      File: class {
        async arrayBuffer() {
          return { byteLength: bytes };
        }
      },
    },
  });
  return {
    service,
    get options() {
      return options;
    },
    get upload() {
      return upload;
    },
  };
}
test("profile picker crops avatar and cover independently and cancellation uploads nothing", async () => {
  const a = media({
    assets: [
      {
        uri: "local://photo",
        type: "image",
        mimeType: "image/jpeg",
        fileSize: 100,
      },
    ],
  });
  const chosen = await a.service.pickMedia({ kind: "avatar" });
  assert.equal(chosen[0].type, "image");
  assert.equal(chosen[0].id, uuid);
  assert.deepEqual(Array.from(a.options.aspect), [1, 1]);
  assert.equal(a.options.allowsMultipleSelection, false);
  await a.service.pickMedia({ kind: "cover" });
  assert.deepEqual(Array.from(a.options.aspect), [16, 9]);
  assert.equal(a.options.exif, false);
  const cancelled = media({ cancel: true });
  assert.equal((await cancelled.service.pickMedia()).length, 0);
  assert.equal(cancelled.upload, undefined);
});
test("albums accept photo/video groups and enforce supported formats, duration and size", async () => {
  for (const [asset, message] of [
    [{ mimeType: "image/gif", type: "image" }, /Selecciona/],
    [
      { mimeType: "image/jpeg", type: "image", fileSize: 6 * 1024 * 1024 },
      /5 MB/,
    ],
    [
      { mimeType: "video/mp4", type: "video", fileSize: 26 * 1024 * 1024 },
      /25 MB/,
    ],
    [{ mimeType: "video/mp4", type: "video", duration: 61000 }, /minuto/],
  ])
    await assert.rejects(
      media({ assets: [asset] }).service.pickMedia(),
      message,
    );
  const grouped = media({
    assets: [
      { uri: "local://a", mimeType: "image/png", type: "image" },
      {
        uri: "local://b",
        mimeType: "video/quicktime",
        type: "video",
        duration: 10000,
      },
    ],
  });
  const files = await grouped.service.pickMedia({ remaining: 2 });
  assert.equal(files.length, 2);
  assert.equal(files[1].extension, "mov");
  assert.equal(grouped.options.allowsMultipleSelection, true);
});
test("byte limits are checked after reading a local file and sessions are bound to owner", async () => {
  const m = media({ bytes: 6 * 1024 * 1024 });
  await assert.rejects(
    m.service.uploadMedia("profile-media", `${user}/avatar/a.jpg`, {
      uri: "local",
      mime: "image/jpeg",
      type: "image",
    }),
    /5 MB/,
  );
  assert.equal(m.upload, undefined);
  await assert.rejects(
    media({ actualUser: "other" }).service.mediaOwner(user),
    /sesión cambió/,
  );
  await assert.rejects(
    media({ actualUser: null }).service.mediaOwner(),
    /sesión cambió/,
  );
});
test("profile media uses private owned paths and never signs a foreign account path", async () => {
  let signed, uploaded;
  const service = load(
    "apps/mobile/src/modules/profile/services/profile-media.service.ts",
    {
      "../../../shared/services/media-upload": {
        mediaOwner: async (id) => {
          assert.equal(id, user);
          return user;
        },
        pickMedia: () => [],
        uploadMedia: async (bucket, p) => {
          uploaded = { bucket, p };
        },
        signedMedia: async (bucket, paths) => {
          signed = { bucket, paths };
          return new Map(paths.map((p) => [p, `signed:${p}`]));
        },
      },
    },
  ).profileMediaService;
  const pathValue = await service.upload(user, "cover", {
    id: uuid,
    extension: "png",
  });
  assert.equal(uploaded.bucket, "profile-media");
  assert.equal(pathValue, `${user}/cover/${uuid}.png`);
  await service.urls(user, "someone/avatar.jpg", pathValue);
  assert.equal(signed.paths.length, 1);
  assert.equal(signed.paths[0], pathValue);
});
test("profile image paths round trip with old account metadata and cannot reference another owner", async () => {
  const model = load("apps/mobile/src/modules/profile/utils/profile-model.ts");
  const own = model.profileFromMetadata("Ana", {
    cycling_profile: {
      avatarPath: `${user}/avatar/a.jpg`,
      coverPath: `${user}/cover/b.jpg`,
    },
  });
  assert.equal(model.validateProfile(own).coverPath, own.coverPath);
  let writes = 0;
  const service = load(
    "apps/mobile/src/modules/profile/services/profile.service.ts",
    {
      "../utils/profile-model": model,
      "../../../shared/supabase/client": {
        getSupabase: () => ({
          auth: {
            getUser: async () => ({
              data: { user: { id: user, user_metadata: {} } },
            }),
            updateUser: async () => {
              writes++;
            },
          },
        }),
      },
    },
  ).profileService;
  await assert.rejects(
    service.update(user, { ...own, avatarPath: "other/avatar.jpg" }),
    /pertenece/,
  );
  assert.equal(writes, 0);
});
function albumBackend() {
  const rows = new Map(),
    uploads = [],
    done = new Set();
  let fail = true,
    actual = user;
  const service = load(
    "apps/mobile/src/modules/albums/services/albums.service.ts",
    {
      "../../../shared/supabase/client": {
        getSupabase: () => ({
          from: () => ({
            upsert: async (row) => {
              rows.set(row.id, row);
              if (fail && row.id === "second")
                return { error: { message: "temporarily offline" } };
              return { error: null };
            },
          }),
        }),
      },
      "../../../shared/services/media-upload": {
        mediaOwner: async (expected) => {
          if (expected && expected !== actual)
            throw new Error("changed session");
          return actual;
        },
        mediaError: () => new Error("retry"),
        uploadMedia: async (bucket, path) => {
          uploads.push({ bucket, path });
          return 10;
        },
        signedMedia: async () => new Map(),
      },
      "../../rides/services/ride-photos.service": { ridePhotosService: {} },
    },
  ).albumsService;
  return {
    service,
    rows,
    uploads,
    done,
    recover: () => {
      fail = false;
    },
    changeUser: () => {
      actual = "other";
    },
  };
}
test("partially uploaded groups retry stable IDs without duplicating media or re-uploading successes", async () => {
  const b = albumBackend(),
    album = { kind: "album", id: uuid },
    files = [
      { id: "first", extension: "jpg", mime: "image/jpeg", type: "image" },
      { id: "second", extension: "mp4", mime: "video/mp4", type: "video" },
    ];
  await assert.rejects(b.service.upload(album, files, b.done), /retry/);
  assert.equal(b.done.size, 1);
  b.recover();
  await b.service.upload(album, files, b.done);
  assert.equal(b.rows.size, 2);
  assert.equal(b.uploads.filter((p) => p.path.endsWith("first.jpg")).length, 1);
  assert.equal(b.rows.get("second").user_id, user);
  await assert.rejects(
    b.service.upload({ kind: "ride", id: uuid }, files),
    /Actividad/,
  );
});
test("ride albums reuse activity photos and manual albums have their own private sources", async () => {
  const service = load(
    "apps/mobile/src/modules/albums/services/albums.service.ts",
    {
      "../../../shared/supabase/client": { getSupabase: () => ({}) },
      "../../../shared/services/media-upload": { mediaOwner: async () => user },
      "../../rides/services/ride-photos.service": {
        ridePhotosService: {
          list: async (id) => {
            assert.equal(id, uuid);
            return [{ path: "ride/photo.jpg", url: "signed-photo" }];
          },
        },
      },
    },
  ).albumsService;
  const items = await service.items({ kind: "ride", id: uuid });
  assert.equal(items[0].url, "signed-photo");
  assert.equal(items[0].type, "image");
});

test("album listing groups route photos by activity alongside named standalone albums", async () => {
  const service = load(
    "apps/mobile/src/modules/albums/services/albums.service.ts",
    {
      "../../../shared/supabase/client": {
        getSupabase: () => ({
          from: (table) => {
            const query = {
              select() {
                return this;
              },
              eq(field, value) {
                assert.equal(value, user);
                return this;
              },
              in(field, values) {
                assert.equal(values[0], uuid);
                return this;
              },
              order() {
                return this;
              },
              async limit() {
                return {
                  data:
                    table === "media_albums"
                      ? [
                          {
                            id: "manual",
                            title: "Playa",
                            created_at: "2026-10-19T10:00:00Z",
                            album_media: [{ count: 2 }],
                          },
                        ]
                      : [
                          {
                            id: uuid,
                            title: "Ruta al parque",
                            ended_at: "2026-10-18T10:00:00Z",
                          },
                        ],
                  error: null,
                };
              },
            };
            return query;
          },
          storage: {
            from: () => ({
              list: async (prefix) => {
                assert.equal(prefix, user);
                return { data: [{ name: uuid, id: null }], error: null };
              },
            }),
          },
        }),
      },
      "../../../shared/services/media-upload": {
        mediaOwner: async (expected) => {
          assert.equal(expected, user);
          return user;
        },
        mediaError: () => new Error("storage"),
      },
      "../../rides/services/ride-photos.service": { ridePhotosService: {} },
    },
  ).albumsService;
  const result = await service.list(50, user);
  assert.equal(result.albums.length, 2);
  assert.equal(result.albums[0].title, "Playa");
  assert.equal(result.albums[0].count, 2);
  assert.equal(result.albums[1].kind, "ride");
  assert.equal(result.albums[1].title, "Ruta al parque");
});
function google({
  cancel = false,
  error = false,
  scheme = "cycling-dev",
  native = false,
  crypto = require("node:crypto").webcrypto,
} = {}) {
  const calls = { oauth: [], exchanges: [], browser: [] };
  const service = load(
    "apps/mobile/src/modules/auth/services/google-auth.service.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "expo-constants": {
        default: { expoConfig: { scheme } },
        __esModule: true,
      },
      "expo-linking": {
        createURL: () => {
          throw new Error("Native OAuth must not inherit the Metro host URI");
        },
      },
      "expo-web-browser": {
        maybeCompleteAuthSession() {},
        openAuthSessionAsync: async (url, redirect) => {
          calls.browser.push({ url, redirect });
          return cancel
            ? { type: "cancel" }
            : { type: "success", url: `${redirect}?code=test-code` };
        },
      },
      "../../../shared/supabase/client": {
        getSupabase: () => ({
          auth: {
            signInWithOAuth: async (request) => {
              calls.oauth.push(request);
              return error
                ? { error: { message: "provider disabled" } }
                : {
                    data: {
                      url: "https://example.supabase.co/auth/v1/authorize",
                    },
                  };
            },
            exchangeCodeForSession: async (code) => {
              calls.exchanges.push(code);
              return { data: { session: { user: { id: user } } } };
            },
          },
        }),
      },
      "expo-crypto": {
        getRandomValues: (array) =>
          require("node:crypto").webcrypto.getRandomValues(array),
        CryptoDigestAlgorithm: { SHA256: "SHA-256" },
        digest: (algorithm, bytes) =>
          require("node:crypto").webcrypto.subtle.digest(algorithm, bytes),
      },
    },
    { crypto: native ? undefined : crypto },
  );
  return { service, calls };
}
test("Google browser login uses Supabase, variant return URI and a code exchange without client secrets", async () => {
  for (const scheme of ["cycling-dev", "cycling"]) {
    const g = google({ scheme });
    assert.equal(await g.service.signInWithGoogle(), true);
    assert.equal(g.calls.oauth[0].provider, "google");
    assert.equal(
      g.calls.oauth[0].options.redirectTo,
      `${scheme}://auth/callback`,
    );
    assert.equal(g.calls.exchanges.length, 1);
    assert.ok(!JSON.stringify(g.calls).includes("GOOGLE_CLIENT_SECRET"));
  }
});
test("cancelled or unavailable Google login never creates a session", async () => {
  const a = google({ cancel: true });
  assert.equal(await a.service.signInWithGoogle(), false);
  assert.equal(a.calls.exchanges.length, 0);
  const b = google({ error: true });
  await assert.rejects(b.service.signInWithGoogle(), /proveedor/);
  assert.equal(b.calls.browser.length, 0);
});
test("OAuth callbacks reject other apps, missing codes and provider errors", () => {
  const g = google().service;
  assert.throws(
    () =>
      g.callbackCode("evil://auth/callback?code=a", "cycling://auth/callback"),
    /corresponde/,
  );
  assert.throws(
    () => g.callbackCode("cycling://auth/callback", "cycling://auth/callback"),
    /código/,
  );
  assert.throws(
    () =>
      g.callbackCode(
        "cycling://auth/callback?error=denied",
        "cycling://auth/callback",
      ),
    /autorizó/,
  );
});
test("warm and cold OAuth callbacks share one exchange and use secure S256 support on Hermes", async () => {
  const g = google({ native: true });
  await g.service.signInWithGoogle();
  await Promise.all([
    g.service.completeGoogleLogin("cycling-dev://auth/callback?code=test-code"),
    g.service.completeGoogleLogin("cycling-dev://auth/callback?code=test-code"),
  ]);
  assert.equal(g.calls.exchanges.length, 1);
  const api = g.service.context.crypto;
  assert.equal(typeof api.getRandomValues, "function");
  const digest = await api.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("abc"),
  );
  assert.equal(
    Buffer.from(digest).toString("hex"),
    require("node:crypto").createHash("sha256").update("abc").digest("hex"),
  );
});
