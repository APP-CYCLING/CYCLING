import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.118.0";
import type { MapDatabase } from "./database.ts";
import { ApiError, record } from "./domain.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeout = 12000,
): Promise<unknown> {
  let result: Response;
  try {
    result = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ApiError(504, "El proveedor tardó demasiado en responder.");
  }
  if (!result.ok)
    throw new ApiError(
      result.status === 429 ? 429 : 502,
      result.status === 429
        ? "Límite del proveedor alcanzado. Inténtalo más tarde."
        : "El servicio geográfico no está disponible.",
    );
  const length = Number(result.headers.get("content-length") ?? 0);
  if (length > 8_000_000) {
    await result.body?.cancel();
    throw new ApiError(502, "Respuesta geográfica demasiado grande.");
  }
  if (!result.body) throw new ApiError(502, "Respuesta vacía del proveedor.");
  const reader = result.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    let part: ReadableStreamReadResult<Uint8Array>;
    try { part = await reader.read(); }
    catch { throw new ApiError(504, "El proveedor interrumpió la descarga. Inténtalo de nuevo."); }
    const { done, value } = part;
    if (done) break;
    size += value.length;
    if (size > 8_000_000) {
      await reader.cancel();
      throw new ApiError(502, "Acerca el mapa para reducir la consulta.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(502, "Respuesta inválida del proveedor.");
  }
}
export function geoapifyUrl(path: string): URL {
  const key = Deno.env.get("GEOAPIFY_API_KEY");
  if (!key)
    throw new ApiError(503, "El servicio geográfico no está configurado.");
  const url = new URL(`https://api.geoapify.com/v1/${path}`);
  url.searchParams.set("apiKey", key);
  return url;
}
export function serve(
  action: "route" | "search" | "lanes",
  handler: (
    body: Record<string, unknown>,
    admin: SupabaseClient<MapDatabase>,
  ) => Promise<unknown>,
) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST")
      return response({ error: "Método no permitido." }, 405);
    try {
      const url = Deno.env.get("SUPABASE_URL"),
        anon = Deno.env.get("SUPABASE_ANON_KEY"),
        service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !anon || !service)
        throw new ApiError(503, "Backend sin configurar.");
      const authorization = request.headers.get("Authorization") ?? "";
      if (!/^Bearer \S+$/i.test(authorization))
        throw new ApiError(401, "Inicia sesión para utilizar el planificador.");
      const auth = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.getUser(
        authorization.replace(/^Bearer /i, ""),
      );
      if (error || !data.user)
        throw new ApiError(
          401,
          "Tu sesión no es válida. Vuelve a iniciar sesión.",
        );
      // El límite es compartido por todas las instancias Edge y falla cerrado si falta la migración.
      const admin = createClient<MapDatabase>(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const quota = await admin.rpc("consume_map_quota", {
        p_action: action,
        p_user_id: data.user.id,
      });
      if (quota.error)
        throw new ApiError(503, "El control de consumo no está disponible.");
      if (quota.data !== true)
        throw new ApiError(
          429,
          "Límite de solicitudes alcanzado. Inténtalo más tarde.",
        );
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 4096) throw new ApiError(413, "Solicitud demasiado grande.");
      // Leer de forma acotada también cuando falta Content-Length.
      const reader = request.body?.getReader();
      let size = 0;
      const parts: Uint8Array[] = [];
      if (!reader) throw new ApiError(400, "Faltan los datos de la solicitud.");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          throw new ApiError(413, "Solicitud demasiado grande.");
        }
        parts.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new ApiError(400, "JSON inválido.");
      }
      return response(await handler(record(body), admin));
    } catch (error: unknown) {
      // No devolver URLs con claves, errores del SDK ni detalles internos.
      return response(
        {
          error:
            error instanceof ApiError
              ? error.message
              : "No se pudo completar la solicitud.",
        },
        error instanceof ApiError ? error.status : 500,
      );
    }
  });
}
