const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(resolve(__dirname, '../apps/mobile/src/shared/config/env.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const publicKey = 'sb_publishable_test';
const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
function load(url, key) {
  const exports = {};
  runInNewContext(compiled, {
    exports, URL, atob,
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key } },
  });
  return exports;
}

test('missing configuration is readable without crashing module imports', () => {
  assert.match(load(undefined, undefined).getConfigurationError(), /Configura/);
});
test('public publishable and legacy anon keys are accepted', () => {
  for (const key of [publicKey, jwt('anon')]) {
    const config = load('https://example.supabase.co', key);
    assert.equal(config.getConfigurationError(), null);
    assert.equal(config.getSupabaseConfig().key, key);
  }
});
test('secret, service-role and malformed keys are rejected', () => {
  for (const key of ['sb_secret_test', jwt('service_role'), 'not-a-key']) {
    const config = load('https://example.supabase.co', key);
    assert.ok(config.getConfigurationError());
    assert.throws(() => config.getSupabaseConfig());
  }
});
test('invalid URLs are rejected and local HTTP development is accepted', () => {
  for (const url of ['invalid', 'file:///example', 'ftp://example.com']) {
    assert.ok(load(url, publicKey).getConfigurationError());
  }
  assert.equal(load('http://localhost:54321', publicKey).getConfigurationError(), null);
});
