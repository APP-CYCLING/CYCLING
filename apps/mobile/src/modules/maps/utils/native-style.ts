import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/** Adaptaciones de Streets v4 al motor Native, sin eliminar fuentes de datos. */
export function normalizeNativeStyle(
  style: StyleSpecification,
): StyleSpecification {
  const sources = { ...style.sources };
  const used = new Set(
    style.layers.flatMap((layer) => ("source" in layer ? [layer.source] : [])),
  );
  const credits: string[] = [];
  for (const [id, source] of Object.entries(sources)) {
    if (!["vector", "raster", "raster-dem"].includes(source.type)) continue;
    if (
      !("url" in source && source.url) &&
      !("tiles" in source && source.tiles?.length)
    ) {
      if (used.has(id))
        throw new Error(
          "El estilo del mapa contiene una fuente de datos sin teselas.",
        );
      if ("attribution" in source && source.attribution)
        credits.push(source.attribution);
      delete sources[id];
    }
  }
  // La fuente vacía del proveedor solo aporta créditos: conservarlos en una fuente real.
  if (credits.length) {
    const first = Object.keys(sources).find((id) =>
      ["vector", "raster", "raster-dem"].includes(sources[id].type),
    );
    if (first) {
      const source = sources[first];
      sources[first] = {
        ...source,
        attribution: [
          ...new Set(
            [
              ("attribution" in source ? source.attribution : "") ?? "",
              ...credits,
            ].filter(Boolean),
          ),
        ].join(" | "),
      } as typeof source;
    }
  }
  const layers = style.layers.map((layer) => {
    if (layer.type !== "symbol" || !layer.layout) return layer;
    const {
      "text-overlap": text,
      "icon-overlap": icon,
      ...layout
    } = layer.layout;
    // Native no implementa cooperative: mantener colisiones conservadoras.
    if (text !== undefined && layout["text-allow-overlap"] === undefined)
      layout["text-allow-overlap"] = text === "always";
    if (icon !== undefined && layout["icon-allow-overlap"] === undefined)
      layout["icon-allow-overlap"] = icon === "always";
    return { ...layer, layout };
  });
  return { ...style, sources, layers };
}
