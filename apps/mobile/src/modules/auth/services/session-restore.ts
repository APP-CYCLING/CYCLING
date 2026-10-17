import type { Session, SupabaseClient } from "@supabase/supabase-js";
type Auth = Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">;
type Result = { session: Session | null; error: string };
const failure =
  "No pudimos recuperar tu sesión. Comprueba la conexión y pulsa Reintentar. Tus datos guardados no se han borrado.";
/** Espera acotada; los eventos de Auth prevalecen sobre lecturas antiguas. */
export function restoreSession(
  auth: Auth,
  onResult: (value: Result) => void,
  timeoutMs = 15000,
) {
  let current = true,
    sawAuthEvent = false,
    expired = false;
  let unsubscribe: (() => void) | undefined;
  const timer = setTimeout(() => {
    if (current && !sawAuthEvent) {
      expired = true;
      onResult({ session: null, error: failure });
    }
  }, timeoutMs);
  const publish = (value: Result) => {
    clearTimeout(timer);
    if (current && !expired) onResult(value);
  };
  try {
    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, session) => {
      if (!current || expired) return;
      sawAuthEvent = true;
      publish({ session, error: "" });
    });
    unsubscribe = () => subscription.unsubscribe();
    void auth
      .getSession()
      .then(({ data, error }) => {
        if (!current || sawAuthEvent || expired) return;
        publish({
          session: error ? null : data.session,
          error: error ? failure : "",
        });
      })
      .catch(() => {
        if (!sawAuthEvent) publish({ session: null, error: failure });
      });
  } catch {
    publish({ session: null, error: failure });
  }
  return () => {
    current = false;
    clearTimeout(timer);
    unsubscribe?.();
  };
}
