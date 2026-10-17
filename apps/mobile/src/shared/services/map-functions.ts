import { getSupabase } from "../supabase/client";

export async function callMapFunction<T>(
  name: string,
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const operation =
    name === "get-bike-lanes"
      ? "consultar las ciclovías"
      : name === "search-destinations"
        ? "buscar destinos"
        : name === "reverse-location"
          ? "identificar la calle"
          : "calcular la ruta";
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, 35000);
  const cancelled = new Promise<never>((_, reject) => {
    const abort = () =>
      reject(
        new Error(
          timedOut
            ? `El servicio tardó demasiado en ${operation}. Reintenta en unos segundos.`
            : "Solicitud cancelada.",
        ),
      );
    controller.signal.addEventListener("abort", abort, { once: true });
  });
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (signal?.aborted) cancel();
    const task = async () => {
      const client = getSupabase();
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();
      if (controller.signal.aborted) throw new Error("Solicitud cancelada.");
      if (sessionError || !sessionData.session)
        throw new Error(
          "Inicia sesión para buscar destinos, calcular rutas y consultar ciclovías.",
        );
      const { data, error } = await client.functions.invoke<T>(name, {
        body,
        signal: controller.signal,
      });
      if (error) {
        const context: unknown = error.context;
        if (context instanceof Response) {
          if (context.status === 401)
            throw new Error("Tu sesión caducó. Vuelve a iniciar sesión.");
          if (context.status === 429)
            throw new Error(
              "Se alcanzó el límite temporal de consultas. Espera un momento y reintenta.",
            );
          const value: unknown = await context.json().catch(() => null);
          if (
            value &&
            typeof value === "object" &&
            "error" in value &&
            typeof value.error === "string"
          )
            throw new Error(value.error);
          if (context.status === 404)
            throw new Error(
              "El servicio solicitado todavía no está desplegado.",
            );
          throw new Error(
            `El servicio no pudo ${operation} (HTTP ${context.status}). Reintenta en unos segundos.`,
          );
        }
        throw new Error(
          `No se pudo conectar para ${operation}. Revisa tu conexión y reintenta.`,
        );
      }
      if (!data) throw new Error("El servicio devolvió una respuesta vacía.");
      return data;
    };
    return await Promise.race([cancelled, task()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
