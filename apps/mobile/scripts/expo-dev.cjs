// Set the same variant for Metro and local native development on every OS.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const result = spawnSync(
  process.execPath,
  [require.resolve("expo/bin/cli"), ...process.argv.slice(2)],
  {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, APP_VARIANT: "development" },
    stdio: "inherit",
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
