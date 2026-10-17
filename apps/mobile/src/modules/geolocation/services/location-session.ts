import type {
  LocationFix,
  LocationProvider,
  LocationReading,
  LocationState,
} from "../types/location.types";
import { isFreshFix, toLocationFix } from "../utils/location-policy";

export const initialLocationState: LocationState = {
  fix: null,
  loading: false,
  error: "",
  status: "idle",
};
export type LocationClock = {
  now: () => number;
  later: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  repeat: (callback: () => void, ms: number) => ReturnType<typeof setInterval>;
  cancelLater: (timer: ReturnType<typeof setTimeout>) => void;
  cancelRepeat: (timer: ReturnType<typeof setInterval>) => void;
};
const systemClock: LocationClock = {
  now: () => Date.now(),
  later: setTimeout,
  repeat: setInterval,
  cancelLater: clearTimeout,
  cancelRepeat: clearInterval,
};

/** Una sesión por pantalla activa: todo el arranque queda acotado, incluidos permisos. */
export function startLocationSession(
  provider: LocationProvider,
  onChange: (state: LocationState) => void,
  clock = systemClock,
) {
  let disposed = false;
  let subscription: { remove: () => void } | undefined;
  let lastFix: LocationFix | null = null;
  let stage: "permission" | "services" | "position" = "permission";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stale: ReturnType<typeof setInterval> | undefined;
  const emit = (state: LocationState) => {
    if (!disposed) onChange(state);
  };
  const stop = () => {
    if (disposed) return;
    disposed = true;
    subscription?.remove();
    if (timeout !== undefined) clock.cancelLater(timeout);
    if (stale !== undefined) clock.cancelRepeat(stale);
  };
  const fail = (status: LocationState["status"], error: string) => {
    emit({ fix: null, loading: false, status, error });
    stop();
  };
  const accept = (reading: LocationReading) => {
    if (disposed) return;
    const fix = toLocationFix(reading, clock.now());
    if (!fix || (lastFix && fix.timestamp < lastFix.timestamp)) return;
    // Una respuesta aproximada tardía no desplaza un fix reciente más preciso.
    if (
      lastFix &&
      clock.now() - lastFix.timestamp < 10000 &&
      lastFix.accuracy != null &&
      (fix.accuracy == null || fix.accuracy > lastFix.accuracy * 2)
    )
      return;
    lastFix = fix;
    if (timeout !== undefined) clock.cancelLater(timeout);
    const approximate = fix.accuracy == null || fix.accuracy > 100;
    emit({
      fix,
      loading: false,
      status: approximate ? "approximate" : "ready",
      error: approximate
        ? "Tu ubicación es aproximada. Activa «Ubicación precisa» en los permisos de cycling para mejorarla."
        : "",
    });
  };
  emit({ fix: null, loading: true, error: "", status: "loading" });
  // Antes de cualquier await: una respuesta nativa que nunca llega no deja un spinner infinito.
  timeout = clock.later(
    () =>
      fail(
        "timeout",
        stage === "permission"
          ? "La solicitud de ubicación no respondió. Revisa los permisos de cycling en Ajustes y vuelve a intentarlo."
          : stage === "services"
            ? "No se pudo comprobar el GPS. Revisa la ubicación del teléfono e inténtalo de nuevo."
            : "No se obtuvo tu ubicación en 20 segundos. Revisa el GPS y la ubicación precisa, y pulsa Reintentar.",
      ),
    20000,
  );
  stale = clock.repeat(() => {
    if (!disposed && lastFix && !isFreshFix(lastFix, clock.now())) {
      lastFix = null;
      emit({
        fix: null,
        loading: false,
        status: "stale",
        error:
          "Se perdió la señal de ubicación. Pulsa Reintentar para localizarte de nuevo.",
      });
    }
  }, 5000);
  void (async () => {
    const permission = await provider.permission();
    if (disposed) return;
    if (!permission.granted) {
      fail(
        "denied",
        permission.canAskAgain
          ? "Permite el acceso a tu ubicación para centrar el mapa. Puedes volver a intentarlo."
          : "El permiso de ubicación está bloqueado. Actívalo en Ajustes → cycling → Permisos.",
      );
      return;
    }
    stage = "services";
    const enabled = await provider.servicesEnabled();
    if (disposed) return;
    if (!enabled) {
      fail(
        "disabled",
        "La ubicación del teléfono está desactivada. Actívala y pulsa Reintentar.",
      );
      return;
    }
    stage = "position";
    // No esperar al primer evento del watcher: iniciar las tres vías en paralelo.
    void provider
      .lastKnown()
      .then((reading) => {
        if (reading) accept(reading);
      })
      .catch(() => {});
    void provider
      .current()
      .then(accept)
      .catch(() => {});
    const watcher = await provider.watch(accept, () => {
      if (!disposed && !lastFix)
        emit({
          fix: null,
          loading: false,
          status: "error",
          error:
            "No se pudo leer tu ubicación. Comprueba el GPS y pulsa Reintentar.",
        });
    });
    if (disposed) {
      watcher.remove();
      return;
    }
    subscription = watcher;
  })().catch(() => {
    if (!disposed && stage === "position") {
      emit({
        fix: isFreshFix(lastFix, clock.now()) ? lastFix : null,
        loading: false,
        status: "error",
        error:
          "No se pudo mantener la señal GPS. Se seguirá intentando obtener una posición inicial; también puedes pulsar Reintentar.",
      });
    } else if (!disposed)
      fail(
        "error",
        "No se pudo acceder a la ubicación. Revisa los permisos y el GPS, y vuelve a intentarlo.",
      );
  });
  return stop;
}
