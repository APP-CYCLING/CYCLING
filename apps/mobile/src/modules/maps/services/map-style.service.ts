import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { normalizeNativeStyle } from "../utils/native-style";

let cache: { expires: number; style: StyleSpecification } | undefined;
export async function loadNativeMapStyle(
  signal: AbortSignal,
): Promise<StyleSpecification> {
  if (cache && cache.expires > Date.now()) return cache.style;
  const key = process.env.EXPO_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("Falta la configuración pública de MapTiler.");
  const response = await fetch(
    `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(key)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "No se pudo descargar el estilo de MapTiler. Revisa la conexión y la configuración del mapa.",
    );
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 8 ||
    !("sources" in value) ||
    !value.sources ||
    typeof value.sources !== "object" ||
    !("layers" in value) ||
    !Array.isArray(value.layers)
  ) {
    throw new Error("MapTiler devolvió un estilo de mapa inválido.");
  }
  const style = normalizeNativeStyle(value as StyleSpecification);
  cache = { expires: Date.now() + 20 * 60000, style };
  return style;
}
