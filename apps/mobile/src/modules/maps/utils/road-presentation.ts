import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/** Presentation only: preserve sources, geometry, road widths, arrows and labels. */
export function roadPresentation(
  style: StyleSpecification,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== "line" || layer["source-layer"] !== "transportation")
        return layer;
      return {
        ...layer,
        paint: {
          ...layer.paint,
          "line-color": /casing|outline|border/i.test(layer.id)
            ? "#747C7D"
            : "#CBD0D0",
        },
      };
    }),
  };
}
