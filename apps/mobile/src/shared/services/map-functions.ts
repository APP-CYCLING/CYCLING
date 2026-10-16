import { getSupabase } from "../supabase/client";

export async function callMapFunction<T>(
  name: string,
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const client = getSupabase();
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  if (sessionError || !sessionData.session)
    throw new Error(
      "Inicia sesión para buscar destinos, calcular rutas y consultar ciclovías.",
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw new Error("Solicitud cancelada.");
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 25000);
  try {
    const { data, error } = await client.functions.invoke<T>(name, {
      body,
      signal: controller.signal,
    });
    if (error) {
      const context: unknown = error.context;
      if (context instanceof Response) {
        const value: unknown = await context.json().catch(() => null);
        if (
          value &&
          typeof value === "object" &&
          "error" in value &&
          typeof value.error === "string"
        )
          throw new Error(value.error);
        if (context.status === 404)
          throw new Error("El servicio de mapas todavía no está desplegado.");
        if (context.status === 401)
          throw new Error("Tu sesión caducó. Vuelve a iniciar sesión.");
      }
      throw new Error(
        "No se pudo conectar con el servicio de mapas. Comprueba tu conexión.",
      );
    }
    if (!data) throw new Error("El servicio devolvió una respuesta vacía.");
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
