import React from "react";
import {
  GeoJSONSource,
  Images,
  Layer,
  type LineLayerSpecification,
  type FilterSpecification,
} from "@maplibre/maplibre-react-native";
import type { LaneCollection, LaneFeature } from "@cycling/contracts";

// Offsets are screen pixels, never new geographical coordinates. MapLibre's
// line-offset is positive to the right of the stored OSM way direction.
const offset: NonNullable<LineLayerSpecification["paint"]>["line-offset"] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13,
  0,
  16,
  ["match", ["get", "side"], "left", -7, "right", 7, 0],
  19,
  ["match", ["get", "side"], "left", -15, "right", 15, 0],
];
const width: NonNullable<LineLayerSpecification["paint"]>["line-width"] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  2,
  16,
  ["case", ["==", ["get", "geometryBasis"], "attribute"], 2, 7],
  19,
  ["case", ["==", ["get", "geometryBasis"], "attribute"], 2, 13],
];
const exclusive: FilterSpecification = [
  "in",
  ["get", "infrastructure"],
  ["literal", ["segregated", "lane"]],
];
export function CycleInfrastructureLayers({
  data,
  onPress,
  beforeId,
}: {
  data: LaneCollection;
  onPress?: (feature: LaneFeature) => void;
  beforeId?: string;
}) {
  return (
    <>
      <Images
        images={{
          "cycling-bicycle": require("../../../../assets/images/cycleway-bicycle.png"),
        }}
      />
      <GeoJSONSource
        id="osm-cycleways"
        data={data}
        tolerance={0.375}
        maxzoom={19}
        onPress={(event) => {
          event.stopPropagation();
          const id = event.nativeEvent.features[0]?.id;
          const feature = data.features.find((feature) => feature.id === id);
          if (feature) onPress?.(feature);
        }}
      >
        <Layer
          id="cycleway-border"
          type="line"
          beforeId={beforeId}
          filter={exclusive}
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": "#174E32",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              3,
              16,
              ["case", ["==", ["get", "geometryBasis"], "attribute"], 3, 9],
              19,
              ["case", ["==", ["get", "geometryBasis"], "attribute"], 3, 15],
            ],
            "line-offset": offset,
          }}
        />
        <Layer
          id="cycleway-segregated"
          type="line"
          beforeId={beforeId}
          filter={["==", ["get", "infrastructure"], "segregated"]}
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": "#008445",
            "line-width": width,
            "line-offset": offset,
          }}
        />
        <Layer
          id="cycleway-center"
          type="line"
          beforeId={beforeId}
          minzoom={15}
          filter={[
            "all",
            ["==", ["get", "infrastructure"], "segregated"],
            ["!=", ["get", "geometryBasis"], "attribute"],
          ]}
          paint={{
            "line-color": "#F5D547",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0.8,
              19,
              1.8,
            ],
            "line-offset": offset,
          }}
        />
        <Layer
          id="cycleway-lane"
          type="line"
          beforeId={beforeId}
          filter={["==", ["get", "infrastructure"], "lane"]}
          paint={{
            "line-color": "#63B66D",
            "line-width": width,
            "line-dasharray": [3, 1.5],
            "line-offset": offset,
          }}
        />
        <Layer
          id="cycleway-shared"
          type="line"
          beforeId={beforeId}
          filter={["==", ["get", "infrastructure"], "shared"]}
          paint={{
            "line-color": "#A18046",
            "line-width": 2,
            "line-dasharray": [1, 3],
          }}
        />
        <Layer
          id="cycleway-unknown"
          type="line"
          beforeId={beforeId}
          filter={["==", ["get", "infrastructure"], "unknown"]}
          paint={{
            "line-color": "#8E9292",
            "line-width": 2,
            "line-dasharray": [2, 3],
          }}
        />
      </GeoJSONSource>
    </>
  );
}

export function CyclewaySymbols() {
  return (
    <Layer
      id="cycleway-bikes"
      source="osm-cycleways"
      type="symbol"
      minzoom={16}
      filter={exclusive}
      layout={{
        "symbol-placement": "line",
        "symbol-spacing": 170,
        "icon-image": "cycling-bicycle",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 16, 0.22, 19, 0.32],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
        "icon-padding": 12,
        "icon-offset": [
          "interpolate",
          ["linear"],
          ["zoom"],
          16,
          [
            "match",
            ["get", "side"],
            "left",
            ["literal", [0, -32]],
            "right",
            ["literal", [0, 32]],
            ["literal", [0, 0]],
          ],
          19,
          [
            "match",
            ["get", "side"],
            "left",
            ["literal", [0, -47]],
            "right",
            ["literal", [0, 47]],
            ["literal", [0, 0]],
          ],
        ],
      }}
    />
  );
}
