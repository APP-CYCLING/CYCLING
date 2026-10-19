import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { getSupabase } from "../../../shared/supabase/client";
WebBrowser.maybeCompleteAuthSession();
const exchanges = new Map<string, Promise<boolean>>();
let opening = false;
export function googleRedirectUri() {
  if (Platform.OS === "web") return Linking.createURL("auth/callback");
  const configured = Constants.expoConfig?.scheme,
    scheme = Array.isArray(configured) ? configured[0] : configured;
  if (!scheme)
    throw new Error(
      "La compilación no tiene un enlace de retorno configurado.",
    );
  // A fixed native URI must not inherit Metro's hostUri in development builds.
  return `${scheme}://auth/callback`;
}
export function callbackCode(url: string, redirect: string) {
  const incoming = new URL(url),
    expected = new URL(redirect);
  if (
    incoming.protocol !== expected.protocol ||
    incoming.host !== expected.host ||
    incoming.pathname !== expected.pathname
  )
    throw new Error("El enlace de acceso no corresponde a CYCLING.");
  if (incoming.searchParams.has("error"))
    throw new Error(
      "Google no autorizó el acceso. Puedes volver a intentarlo.",
    );
  const code = incoming.searchParams.get("code");
  if (!code || code.length > 4096)
    throw new Error("El enlace de acceso no contiene un código válido.");
  return code;
}
export async function completeGoogleLogin(url: string) {
  const code = callbackCode(url, googleRedirectUri());
  let pending = exchanges.get(code);
  if (!pending) {
    pending = (async () => {
      const { data, error } =
        await getSupabase().auth.exchangeCodeForSession(code);
      if (error || !data.session)
        throw new Error(
          "No se pudo completar el acceso con Google. Inicia el proceso otra vez.",
        );
      return true;
    })();
    exchanges.set(code, pending);
    if (exchanges.size > 20) exchanges.delete(exchanges.keys().next().value!);
  }
  return pending;
}
async function ensurePkceCrypto() {
  if (Platform.OS === "web") return;
  const native = await import("expo-crypto");
  // Supabase PKCE uses getRandomValues and SHA-256. Avoid its plain fallback on Hermes.
  const cryptoApi = globalThis.crypto ?? ({} as Crypto);
  if (!cryptoApi.getRandomValues)
    Object.defineProperty(cryptoApi, "getRandomValues", {
      value: native.getRandomValues,
      configurable: true,
    });
  if (!cryptoApi.subtle)
    Object.defineProperty(cryptoApi, "subtle", {
      value: {
        digest: (algorithm: string, data: BufferSource) => {
          if (algorithm !== "SHA-256")
            throw new Error("Algoritmo no admitido.");
          return native.digest(native.CryptoDigestAlgorithm.SHA256, data);
        },
      },
      configurable: true,
    });
  if (!globalThis.crypto)
    Object.defineProperty(globalThis, "crypto", {
      value: cryptoApi,
      configurable: true,
    });
}
export async function signInWithGoogle() {
  if (opening) return false;
  opening = true;
  try {
    await ensurePkceCrypto();
    const redirectTo = googleRedirectUri();
    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== "web",
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url)
      throw new Error(
        "El acceso con Google no está disponible. Comprueba que el proveedor esté configurado en Supabase.",
      );
    if (Platform.OS === "web") return false;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return false;
    return await completeGoogleLogin(result.url);
  } catch (error) {
    if (
      error instanceof Error &&
      /native module|Cannot find|not available/i.test(error.message)
    )
      throw new Error(
        "Instala una nueva APK de CYCLING para habilitar el acceso con Google.",
      );
    throw error;
  } finally {
    opening = false;
  }
}
