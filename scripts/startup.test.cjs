const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(file, modules = {}, globals = {}) {
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
    Error,
    ...globals,
    require: (name) => {
      if (name.endsWith("/ThemeContext"))
        return {
          useTheme: () => ({ scheme: "light", colors: {} }),
          useThemedStyles: (factory) => factory({}),
        };
      if (name.startsWith("../../assets/fonts/")) return 1;
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports;
}
function clock() {
  let now = 0,
    sequence = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++sequence;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of timers)
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
    },
  };
}
function hooks() {
  const cells = [];
  let cursor = 0,
    effects = [];
  return {
    react: {
      createElement: (type, props, ...children) => ({
        type,
        props: { ...props, children },
      }),
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
      useEffect(fn, deps) {
        const i = cursor++,
          previous = cells[i];
        if (!previous || deps.some((value, j) => value !== previous.deps[j]))
          effects.push(() => {
            previous?.cleanup?.();
            cells[i] = { deps, cleanup: fn() };
          });
      },
    },
    render(fn) {
      cursor = 0;
      const result = fn();
      const pending = effects;
      effects = [];
      pending.forEach((fn) => fn());
      return result;
    },
  };
}
test("root shows native loading content while fonts are pending, then mounts the app even if they never resolve", () => {
  const time = clock(),
    runtime = hooks();
  let loaded = false,
    fontError = null;
  const { RootContent: Root } = load(
    "apps/mobile/src/app/_layout.tsx",
    {
      react: runtime.react,
      "expo-font": { useFonts: () => [loaded, fontError] },
      "expo-router": { Stack: Object.assign("Stack", { Screen: "Screen" }) },
      "expo-status-bar": { StatusBar: "StatusBar" },
      "expo-system-ui": { setBackgroundColorAsync: async () => {} },
      "../modules/auth/context/AuthContext": { AuthProvider: "AuthProvider" },
      "../modules/rides/components/RecordingLifecycle": {
        RecordingLifecycle: "RecordingLifecycle",
      },
      "../shared/config/env": { getConfigurationError: () => null },
      "../shared/components/StartupScreen": { StartupScreen: "StartupScreen" },
      "../shared/theme/FontContext": {
        FontReadyContext: { Provider: "FontProvider" },
      },
      "../shared/theme/colors": { colors: {} },
    },
    time,
  );
  const render = () => runtime.render(Root);
  assert.equal(render().type, "StartupScreen");
  time.advance(3000);
  const fallback = render();
  assert.equal(fallback.type, "FontProvider");
  assert.equal(fallback.props.value, false);
  assert.equal(fallback.props.children[0].type, "AuthProvider");
  loaded = true;
  assert.equal(render().props.value, true);
  loaded = false;
  fontError = new Error("font download failed");
  assert.equal(render().type, "FontProvider");
});
test("visible startup frame hides the native splash without waiting for the navigator or custom fonts", async () => {
  let hidden = 0;
  const { StartupScreen } = load(
    "apps/mobile/src/shared/components/StartupScreen.tsx",
    {
      react: {
        createElement: (type, props, ...children) => ({
          type,
          props: { ...props, children },
        }),
      },
      "react-native": {
        ActivityIndicator: "Spinner",
        Pressable: "Button",
        Text: "SystemText",
        View: "View",
        StyleSheet: { create: (x) => x },
      },
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "expo-router": {
        SplashScreen: {
          hideAsync: async () => {
            hidden++;
          },
        },
      },
      "../theme/colors": { colors: {} },
      "./BrandLogo": { BrandLogo: "BrandLogo" },
      "./BrandLoader": { BrandLoader: "BrandLoader" },
      "expo-status-bar": { StatusBar: "StatusBar" },
    },
  );
  const tree = StartupScreen({ message: "Loading", loading: true });
  assert.equal(tree.type, "SafeAreaView");
  tree.props.onLayout();
  await Promise.resolve();
  assert.equal(hidden, 1);
});
test("custom font fallback keeps the chosen weight and layout without requesting unregistered font families", () => {
  const { fonts } = load("apps/mobile/src/shared/theme/typography.ts");
  const { appTextTypography } = load(
    "apps/mobile/src/shared/theme/font-fallback.ts",
    { "./typography": { fonts } },
  );
  const style = appTextTypography(false, "regular", {
    fontFamily: fonts.heavy,
    fontSize: 32,
  });
  assert.equal(style.fontFamily, undefined);
  assert.equal(style.fontWeight, "800");
  assert.equal(style.fontSize, 32);
  assert.equal(appTextTypography(true, "heavy").fontFamily, fonts.heavy);
  assert.equal(
    appTextTypography(false, "regular", { fontFamily: "ExternalFont" })
      .fontFamily,
    "ExternalFont",
  );
});
const flush = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};
function restoreFixture(getSession) {
  const time = clock(),
    results = [];
  let event,
    unsubscribed = 0;
  const auth = {
    getSession,
    onAuthStateChange(callback) {
      event = callback;
      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribed++;
            },
          },
        },
      };
    },
  };
  const { restoreSession } = load(
    "apps/mobile/src/modules/auth/services/session-restore.ts",
    {},
    time,
  );
  const stop = restoreSession(auth, (value) => results.push(value));
  return {
    time,
    results,
    stop,
    emit: (session) => event("SIGNED_IN", session),
    get unsubscribed() {
      return unsubscribed;
    },
  };
}
test("a hung session read reaches a retryable error rather than waiting indefinitely and ignores late responses", async () => {
  let resolveRead;
  const fixture = restoreFixture(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
  );
  fixture.time.advance(14999);
  assert.equal(fixture.results.length, 0);
  fixture.time.advance(1);
  assert.match(fixture.results[0].error, /Reintentar/);
  assert.equal(fixture.results[0].session, null);
  resolveRead({ data: { session: { user: { id: "late" } } }, error: null });
  await flush();
  assert.equal(fixture.results.length, 1);
  fixture.stop();
  assert.equal(fixture.unsubscribed, 1);
});
test("authoritative auth event releases startup immediately and cannot be replaced by an older cached read", async () => {
  let resolveRead;
  const fixture = restoreFixture(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
  );
  fixture.emit({ user: { id: "current" } });
  fixture.time.advance(30000);
  assert.equal(fixture.results.length, 1);
  assert.equal(fixture.results[0].session.user.id, "current");
  resolveRead({ data: { session: { user: { id: "old" } } }, error: null });
  await flush();
  assert.equal(fixture.results.length, 1);
  fixture.emit(null);
  assert.equal(fixture.results.at(-1).session, null);
  fixture.stop();
  fixture.emit({ user: { id: "after-unmount" } });
  assert.equal(fixture.results.length, 2);
});
test("session errors and anonymous startup finish visibly, and a retry can recover a valid session", async () => {
  const failed = restoreFixture(async () => {
    throw new Error("offline");
  });
  await flush();
  assert.match(failed.results[0].error, /conexión/);
  failed.stop();
  const guest = restoreFixture(async () => ({
    data: { session: null },
    error: null,
  }));
  await flush();
  assert.equal(guest.results[0].error, "");
  assert.equal(guest.results[0].session, null);
  guest.stop();
  const retry = restoreFixture(async () => ({
    data: { session: { user: { id: "restored" } } },
    error: null,
  }));
  await flush();
  assert.equal(retry.results[0].session.user.id, "restored");
  retry.stop();
});
