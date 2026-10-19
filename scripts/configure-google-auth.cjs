// Run from the repository root: node scripts/configure-google-auth.cjs [--apply]
const { readEnv, management } = require("./lib/supabase-management.cjs");
async function main() {
  const env = readEnv(),
    url = new URL(env.EXPO_PUBLIC_SUPABASE_URL),
    ref = url.hostname.split(".")[0];
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("Project ref inválido.");
  if (
    !env.GOOGLE_CLIENT_ID?.endsWith(".apps.googleusercontent.com") ||
    !env.GOOGLE_CLIENT_SECRET
  )
    throw new Error(
      "Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET válidos en apps/mobile/.env.",
    );
  const current = await management(`projects/${ref}/config/auth`);
  const redirects = ["cycling-dev://auth/callback", "cycling://auth/callback"];
  const allow = [
    ...new Set([
      ...(current.uri_allow_list || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      ...redirects,
    ]),
  ].join(",");
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        project: ref,
        googleEnabled: current.external_google_enabled,
        redirectsReady: redirects.every((uri) =>
          (current.uri_allow_list || "").split(",").includes(uri),
        ),
        expectedGoogleCallback: `${url.origin}/auth/v1/callback`,
        mode: "read-only",
      }),
    );
    return;
  }
  await management(`projects/${ref}/config/auth`, {
    method: "PATCH",
    body: {
      external_google_enabled: true,
      external_google_client_id: env.GOOGLE_CLIENT_ID,
      external_google_secret: env.GOOGLE_CLIENT_SECRET,
      external_google_redirect_uri: `${url.origin}/auth/v1/callback`,
      uri_allow_list: allow,
    },
  });
  const checked = await management(`projects/${ref}/config/auth`);
  console.log(
    JSON.stringify({
      project: ref,
      googleEnabled: checked.external_google_enabled,
      clientMatches: checked.external_google_client_id === env.GOOGLE_CLIENT_ID,
      redirectsReady: redirects.every((uri) =>
        (checked.uri_allow_list || "").split(",").includes(uri),
      ),
      credentialsDisplayed: false,
    }),
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "No se pudo configurar Google.",
  );
  process.exitCode = 1;
});
