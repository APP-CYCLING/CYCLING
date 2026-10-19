const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, modules = {}) {
  const exports = {},
    absolute = path.resolve(root, file);
  const source = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name.endsWith(".png")) {
        const asset = path.resolve(path.dirname(absolute), name);
        assert.ok(fs.existsSync(asset), asset);
        return asset;
      }
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const palettes = load("apps/mobile/src/shared/theme/colors.ts");
const react = {
  createElement: (type, props, ...children) => ({
    type,
    props: { ...props, children },
  }),
  useMemo: (fn) => fn(),
  createContext: (value) => ({ Provider: "Provider", value }),
  useContext: () => null,
};
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((t) => nodes(t, predicate));
  return [
    ...(predicate(tree) ? [tree] : []),
    ...nodes(tree.props?.children, predicate),
  ];
}
test("theme defaults to light on a dark phone and changes only through the saved app preference", async () => {
  const { ThemePreference } = load(
    "apps/mobile/src/shared/theme/theme-preference.ts",
  );
  let provided,
    saved = null;
  const native = [];
  const theme = load("apps/mobile/src/shared/theme/ThemeContext.tsx", {
    react: {
      ...react,
      useContext: (context) => provided ?? context.value,
      useSyncExternalStore: (_, snapshot) => snapshot(),
      useEffect: (fn) => fn(),
    },
    "react-native": {
      useColorScheme: () => {
        throw new Error("Must not read the phone theme");
      },
      Appearance: { setColorScheme: (value) => native.push(value) },
    },
    "@react-native-async-storage/async-storage": {
      getItem: async () => saved,
      setItem: async (_, value) => {
        saved = value;
      },
    },
    "./theme-preference": { ThemePreference },
    "./colors": palettes,
  });
  const render = () => {
    provided = theme.ThemeProvider({ children: "screen" }).props.value;
  };
  render();
  assert.equal(theme.useThemeColors(), palettes.lightColors);
  assert.equal(native.at(-1), "light");
  await provided.setDarkMode(true);
  render();
  assert.equal(theme.useThemeColors(), palettes.darkColors);
  assert.equal(native.at(-1), "dark");
  await provided.setDarkMode(false);
  render();
  assert.equal(theme.useThemeColors(), palettes.lightColors);
  assert.equal(native.at(-1), "light");
  assert.equal(palettes.darkColors.black, "#0F1210");
  assert.equal(palettes.darkColors.white, "#FFFFFF");
  assert.equal(palettes.darkColors.green, "#A7F55B");
});
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("dark mode persists across app launches and can be switched back to light", async () => {
  const { ThemePreference } = load(
    "apps/mobile/src/shared/theme/theme-preference.ts",
  );
  let saved = null;
  const storage = {
    getItem: async () => saved,
    setItem: async (_, value) => {
      saved = value;
    },
  };
  const first = new ThemePreference(storage);
  await first.restore();
  assert.equal(first.getSnapshot().scheme, "light");
  await first.setDarkMode(true);
  const reopened = new ThemePreference(storage);
  await reopened.restore();
  assert.equal(reopened.getSnapshot().scheme, "dark");
  await reopened.setDarkMode(false);
  const again = new ThemePreference(storage);
  await again.restore();
  assert.equal(again.getSnapshot().scheme, "light");
});

test("late preference hydration cannot replace a new selection, and rapid writes preserve the last choice", async () => {
  const { ThemePreference } = load(
    "apps/mobile/src/shared/theme/theme-preference.ts",
  );
  let resolveRead, saved;
  const preference = new ThemePreference({
    getItem: () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    setItem: async (_, value) => {
      saved = value;
    },
  });
  const loading = preference.restore();
  const first = preference.setDarkMode(true);
  const second = preference.setDarkMode(false);
  resolveRead("dark");
  await Promise.all([loading, first, second]);
  assert.equal(preference.getSnapshot().scheme, "light");
  assert.equal(saved, "light");
  assert.equal(preference.getSnapshot().saving, false);
});

test("unreadable and invalid preferences fall back to light without blocking the app", async () => {
  const { ThemePreference } = load(
    "apps/mobile/src/shared/theme/theme-preference.ts",
  );
  for (const storage of [
    { getItem: async () => "system" },
    {
      getItem: async () => {
        throw new Error("read failed");
      },
    },
  ]) {
    const preference = new ThemePreference(storage);
    await preference.restore();
    assert.equal(preference.getSnapshot().ready, true);
    assert.equal(preference.getSnapshot().scheme, "light");
  }
});

test("failed theme persistence shows an error and subsequent selections can recover", async () => {
  const { ThemePreference } = load(
    "apps/mobile/src/shared/theme/theme-preference.ts",
  );
  let fail = true,
    saved;
  const preference = new ThemePreference({
    getItem: async () => null,
    setItem: async (_, value) => {
      if (fail) throw new Error("disk full");
      saved = value;
    },
  });
  await preference.restore();
  await preference.setDarkMode(true);
  assert.equal(preference.getSnapshot().scheme, "dark");
  assert.equal(preference.getSnapshot().saving, false);
  assert.match(preference.getSnapshot().error, /no se pudo guardar/);
  fail = false;
  await preference.setDarkMode(false);
  assert.equal(saved, "light");
  assert.equal(preference.getSnapshot().error, "");
});

test("settings exposes a native accessible switch connected to the app preference", async () => {
  let enabled;
  const { ThemeSettingsRow } = load(
    "apps/mobile/src/shared/components/ThemeSettingsRow.tsx",
    {
      react,
      "react-native": { Switch: "Switch", View: "View" },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "./DesignSystem": { AppText: "Text" },
      "../theme/ThemeContext": {
        useTheme: () => ({
          scheme: "light",
          ready: true,
          saving: false,
          error: "",
          colors: palettes.lightColors,
          setDarkMode: async (value) => {
            enabled = value;
          },
        }),
      },
    },
  );
  const control = nodes(
    ThemeSettingsRow(),
    (node) => node.type === "Switch",
  )[0];
  assert.equal(control.props.accessibilityLabel, "Modo oscuro");
  assert.equal(control.props.value, false);
  assert.equal(control.props.disabled, false);
  control.props.onValueChange(true);
  assert.equal(enabled, true);
});
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test("main copy, secondary copy, notices and lime buttons have readable contrast in both themes", () => {
  for (const c of [palettes.lightColors, palettes.darkColors]) {
    assert.ok(contrast(c.text, c.background) >= 7);
    assert.ok(contrast(c.text, c.surface) >= 7);
    assert.ok(contrast(c.muted, c.surface) >= 4.5);
    assert.ok(contrast(c.greenDark, c.softGreen) >= 4.5);
    assert.ok(contrast(c.black, c.green) >= 7);
  }
});
test("official logo variants preserve aspect ratio and light mode combines the original C with original dark lettering", () => {
  let scheme = "light";
  const { BrandLogo, brandAssets } = load(
    "apps/mobile/src/shared/components/BrandLogo.tsx",
    {
      react,
      "react-native": { Image: "Image", View: "View" },
      "../theme/ThemeContext": { useTheme: () => ({ scheme }) },
    },
  );
  let tree = BrandLogo({ width: 170 });
  assert.equal(tree.props.style[1].aspectRatio, 3);
  const images = nodes(tree, (n) => n.type === "Image");
  assert.equal(images.length, 2);
  assert.equal(images[0].props.source, brandAssets.horizontalDark);
  assert.equal(images[1].props.source, brandAssets.horizontal);
  scheme = "dark";
  tree = BrandLogo({});
  assert.equal(
    nodes(tree, (n) => n.type === "Image")[0].props.source,
    brandAssets.horizontal,
  );
  assert.equal(
    nodes(BrandLogo({ monochrome: true }), (n) => n.type === "Image")[0].props
      .source,
    brandAssets.horizontalWhite,
  );
  assert.equal(BrandLogo({ variant: "emblem" }).props.style[1].aspectRatio, 1);
});
function hooks() {
  const cells = [];
  let cursor = 0,
    effects = [];
  const different = (a, b) =>
    !a || a.length !== b.length || a.some((v, i) => v !== b[i]);
  return {
    react: {
      ...react,
      useState(v) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = v;
        return [
          cells[i],
          (next) => {
            cells[i] = typeof next === "function" ? next(cells[i]) : next;
          },
        ];
      },
      useRef(v) {
        const i = cursor++;
        if (!(i in cells)) cells[i] = { current: v };
        return cells[i];
      },
      useEffect(fn, deps) {
        const i = cursor++;
        if (different(cells[i]?.deps, deps)) {
          const old = cells[i];
          cells[i] = { deps };
          effects.push(() => {
            old?.cleanup?.();
            cells[i].cleanup = fn();
          });
        }
      },
    },
    render(fn) {
      cursor = 0;
      const result = fn();
      while (effects.length) effects.shift()();
      return result;
    },
    cleanup() {
      cells.forEach((c) => c?.cleanup?.());
    },
  };
}
test("loader uses supplied motion frames and stops for reduced motion, late preference reads, background and unmount", async () => {
  const runtime = hooks(),
    events = {},
    playback = [];
  let resolveInitial,
    removed = 0,
    cancelled = 0,
    scheme = "dark";
  const motion = load("apps/mobile/src/shared/components/brand-motion.ts");
  const { BrandLoader } = load(
    "apps/mobile/src/shared/components/BrandLoader.tsx",
    {
      react: runtime.react,
      "react-native": {
        Image: "Image",
        View: "View",
        Text: "Text",
        AccessibilityInfo: {
          isReduceMotionEnabled: () =>
            new Promise((resolve) => {
              resolveInitial = resolve;
            }),
          addEventListener: (name, fn) => {
            events[name] = fn;
            return {
              remove() {
                removed++;
              },
            };
          },
        },
        AppState: {
          currentState: "active",
          addEventListener: (name, fn) => {
            events[name] = fn;
            return {
              remove() {
                removed++;
              },
            };
          },
        },
      },
      "react-native-reanimated": {
        default: { View: "AnimatedView" },
        useReducedMotion: () => false,
        useSharedValue: (v) => runtime.react.useRef({ value: v }).current,
        useAnimatedStyle: (fn) => fn(),
        cancelAnimation: () => {
          cancelled++;
        },
        Easing: { linear: "linear" },
        ReduceMotion: { System: "system" },
        withTiming: (value, options) => ({ value, options }),
        withRepeat: (value, count) => {
          playback.push({ value, count });
          return 0;
        },
      },
      "../theme/ThemeContext": { useTheme: () => ({ scheme }) },
      "./BrandLogo": { BrandLogo: "BrandLogo" },
      "./brand-motion": motion,
    },
  );
  let tree = runtime.render(() =>
    BrandLoader({ size: "large", fullScreen: true, message: "Cargando rutas" }),
  );
  assert.equal(tree.props.accessibilityLabel, "Cargando rutas");
  assert.equal(tree.props.accessibilityRole, "progressbar");
  assert.equal(nodes(tree, (n) => typeof n.type === "function").length, 16);
  assert.equal(playback[0].count, -1);
  assert.equal(playback[0].value.options.reduceMotion, "system");
  events.reduceMotionChanged(true);
  resolveInitial(false);
  await Promise.resolve();
  tree = runtime.render(() => BrandLoader({}));
  assert.equal(
    nodes(tree, (n) => n.type === "BrandLogo").length,
    1,
    "late read must not override the live reduce-motion setting",
  );
  const before = playback.length;
  scheme = "light";
  runtime.render(() => BrandLoader({}));
  assert.equal(playback.length, before);
  events.reduceMotionChanged(false);
  tree = runtime.render(() => BrandLoader({}));
  assert.equal(nodes(tree, (n) => typeof n.type === "function").length, 24);
  events.change("background");
  tree = runtime.render(() => BrandLoader({}));
  assert.equal(nodes(tree, (n) => n.type === "BrandLogo").length, 1);
  runtime.cleanup();
  assert.equal(removed, 2);
  assert.ok(cancelled >= 3);
});
test("native configuration references real PNGs, preserves package, defaults to light appearance and has no GIF splash", () => {
  const c = JSON.parse(
    fs.readFileSync(path.join(root, "apps/mobile/app.json"), "utf8"),
  ).expo;
  assert.equal(c.android.package, "com.cycling.app");
  assert.equal(c.userInterfaceStyle, "light");
  assert.equal(c.backgroundColor, "#FFFFFF");
  const splash = c.plugins.find(
    (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
  )[1];
  for (const file of [
    c.icon,
    c.android.adaptiveIcon.foregroundImage,
    c.android.adaptiveIcon.monochromeImage,
    splash.image,
  ]) {
    const p = path.resolve(root, "apps/mobile", file);
    assert.ok(fs.existsSync(p));
    assert.equal(path.extname(p), ".png");
    const bytes = fs.readFileSync(p);
    assert.equal(bytes.toString("ascii", 1, 4), "PNG");
    assert.ok(bytes.readUInt32BE(16) >= 200);
    assert.ok(bytes.readUInt32BE(20) >= 200);
  }
  assert.equal(
    splash.dark,
    undefined,
    "native splash must not follow the phone theme",
  );
  const monochrome = fs.readFileSync(
    path.resolve(root, "apps/mobile", c.android.adaptiveIcon.monochromeImage),
  );
  assert.equal(monochrome[25], 6, "RGBA mask supports transparent exterior");
  assert.equal(
    fs.existsSync(
      path.resolve(root, "apps/mobile/assets/branding/05_MARKETING"),
    ),
    false,
  );
});
