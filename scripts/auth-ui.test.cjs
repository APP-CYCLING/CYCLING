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
        esModuleInterop: true,
      },
    },
  ).outputText;
  runInNewContext(code, {
    exports,
    Error,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports;
}
const model = load("apps/mobile/src/modules/auth/utils/auth-form.ts");
const credentials = {
  name: "Ana Pérez",
  email: "ana@example.com",
  password: "  password  ",
};
test("auth validates email and registration fields while allowing existing shorter login passwords", () => {
  assert.equal(
    Object.keys(
      model.validateAuthForm("login", {
        ...credentials,
        name: "",
        password: "short",
      }),
    ).length,
    0,
  );
  assert.equal(
    Object.keys(model.validateAuthForm("register", credentials)).length,
    0,
  );
  const errors = model.validateAuthForm("register", {
    name: "A",
    email: "invalid",
    password: "short",
  });
  assert.equal(Object.keys(errors).sort().join(), "email,name,password");
  assert.equal(model.validEmail(" ana@example.com "), true);
  assert.equal(model.validEmail("ana @example.com"), false);
});
test("auth errors are actionable Spanish messages and never echo an unknown server message", () => {
  assert.match(
    model.authErrorMessage({ code: "invalid_credentials" }),
    /no son correctos/,
  );
  assert.match(
    model.authErrorMessage({ code: "email_not_confirmed" }),
    /Confirma/,
  );
  assert.match(model.authErrorMessage({ status: 429 }), /Espera/);
  assert.match(
    model.authErrorMessage(new Error("Network request failed")),
    /conexión/,
  );
  assert.ok(
    !model
      .authErrorMessage({ message: "sensitive opaque server data" })
      .includes("sensitive"),
  );
});
test("remembering an email stores only the email and the preference, and opting out removes the email", async () => {
  let value = null;
  const { rememberedEmailService: service } = load(
    "apps/mobile/src/modules/auth/services/remembered-email.service.ts",
    {
      "@react-native-async-storage/async-storage": {
        getItem: async () => value,
        setItem: async (_, next) => {
          value = next;
        },
      },
      "../utils/auth-form": model,
    },
  );
  await service.save(" ana@example.com ", true);
  const stored = JSON.parse(value);
  assert.deepEqual(stored, { remember: true, email: "ana@example.com" });
  assert.equal((await service.load()).email, "ana@example.com");
  await service.save("ana@example.com", false);
  assert.equal((await service.load()).remember, false);
  assert.equal((await service.load()).email, "");
  assert.ok(!value.includes("ana@example.com"));
  value = "invalid JSON";
  assert.equal((await service.load()).email, "");
  value = JSON.stringify({
    remember: true,
    email: "invalid",
    password: "ignored",
  });
  assert.equal((await service.load()).email, "");
});
function hooks() {
  const cells = [];
  let cursor = 0,
    effects = [];
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
      useEffect(fn, deps) {
        const index = cursor++,
          previous = cells[index];
        if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
          effects.push(() => {
            previous?.cleanup?.();
            cells[index] = { deps, cleanup: fn() };
          });
        }
      },
    },
    render(fn) {
      cursor = 0;
      const result = fn();
      const pending = effects;
      effects = [];
      pending.forEach((effect) => effect());
      return result;
    },
    unmount() {
      cells.forEach((cell) => cell?.cleanup?.());
    },
  };
}
const flush = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};
function formWith({
  login = async () => {},
  register = async () => true,
  storageLoad = async () => ({ email: "", remember: true }),
  canGoBack = true,
} = {}) {
  const runtime = hooks(),
    navigation = [],
    remembered = [];
  const { useAuthForm } = load(
    "apps/mobile/src/modules/auth/hooks/useAuthForm.ts",
    {
      react: runtime.react,
      "expo-router": {
        router: {
          canGoBack: () => canGoBack,
          back: () => navigation.push("back"),
          replace: (path) => navigation.push(path),
        },
      },
      "../context/AuthContext": { useAuth: () => ({ login, register }) },
      "../services/remembered-email.service": {
        rememberedEmailService: {
          load: storageLoad,
          save: async (email, remember) => {
            remembered.push({ email, remember });
          },
        },
      },
      "../utils/auth-form": model,
    },
  );
  return {
    ...runtime,
    render: () => runtime.render(useAuthForm),
    navigation,
    remembered,
  };
}
test("successful login trims email but preserves password and returns to the previous screen", async () => {
  const calls = [],
    form = formWith({ login: async (input) => calls.push(input) });
  let value = form.render();
  await flush();
  value = form.render();
  value.update("email", " ana@example.com ");
  value.update("password", credentials.password);
  value = form.render();
  await value.submit();
  assert.equal(calls[0].email, "ana@example.com");
  assert.equal(calls[0].password, credentials.password);
  assert.deepEqual(form.navigation, ["back"]);
  assert.equal(form.render().password, "");
  assert.equal(form.remembered.length, 1);
});
test("registration requiring confirmation returns to login without claiming an active session", async () => {
  const calls = [],
    form = formWith({
      register: async (input) => {
        calls.push(input);
        return true;
      },
    });
  let value = form.render();
  await flush();
  value = form.render();
  value.switchMode();
  value = form.render();
  value.update("name", " Ana Pérez ");
  value.update("email", credentials.email);
  value.update("password", credentials.password);
  value = form.render();
  await value.submit();
  value = form.render();
  assert.equal(calls[0].name, "Ana Pérez");
  assert.equal(value.mode, "login");
  assert.equal(value.password, "");
  assert.equal(value.email, credentials.email);
  assert.match(value.success, /confirma tu cuenta/);
  assert.deepEqual(form.navigation, []);
  assert.equal(form.remembered.length, 0);
});
test("form rejects invalid input without contacting auth and ignores duplicate submissions while busy", async () => {
  let finish,
    count = 0;
  const form = formWith({
    login: () => {
      count++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  let value = form.render();
  await flush();
  value = form.render();
  await value.submit();
  assert.equal(count, 0);
  value.update("email", credentials.email);
  value.update("password", credentials.password);
  value = form.render();
  const pending = value.submit();
  await value.submit();
  assert.equal(count, 1);
  value = form.render();
  assert.equal(value.busy, true);
  value.switchMode();
  assert.equal(form.render().mode, "login");
  finish();
  await pending;
});
test("remembered email arriving late never overwrites an address already typed by the user", async () => {
  let resolveLoad;
  const form = formWith({
    storageLoad: () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
  });
  let value = form.render();
  value.update("email", "new@example.com");
  value.toggleRemember();
  resolveLoad({ email: "old@example.com", remember: true });
  await flush();
  value = form.render();
  assert.equal(value.email, "new@example.com");
  assert.equal(value.remember, false);
});
test("failed login remains in the form and a late success after leaving does not redirect the user", async () => {
  const form = formWith({
    login: async () => {
      throw { code: "invalid_credentials" };
    },
  });
  let value = form.render();
  await flush();
  value = form.render();
  value.update("email", credentials.email);
  value.update("password", credentials.password);
  value = form.render();
  await value.submit();
  assert.match(form.render().error, /no son correctos/);
  assert.equal(form.render().busy, false);
  assert.deepEqual(form.navigation, []);
  let done;
  const late = formWith({
    login: () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  });
  value = late.render();
  await flush();
  value = late.render();
  value.update("email", credentials.email);
  value.update("password", credentials.password);
  value = late.render();
  const request = value.submit();
  late.unmount();
  done();
  await request;
  assert.deepEqual(late.navigation, []);
});
test("immediately authenticated registration opened directly navigates to the app home", async () => {
  const form = formWith({ register: async () => false, canGoBack: false });
  let value = form.render();
  await flush();
  value = form.render();
  value.switchMode();
  value = form.render();
  value.update("name", credentials.name);
  value.update("email", credentials.email);
  value.update("password", credentials.password);
  value = form.render();
  await value.submit();
  assert.deepEqual(form.navigation, ["/"]);
});
