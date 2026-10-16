import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Map as MapLibreMap,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Feature, LineString } from "geojson";
import type { CyclingMapProps } from "../types/map.types";
import {
  boundsOf,
  geometryPoints,
  toPosition,
  validCoordinate,
} from "../utils/geometry";
import { colors } from "../../../shared/theme/colors";

const styleUrl = `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(process.env.EXPO_PUBLIC_MAPTILER_KEY ?? "")}`;
export function NativeCyclingMap(props: CyclingMapProps) {
  const {
    height = 330,
    fill,
    origin,
    destination,
    geometry,
    infrastructure,
    onPick,
    onBoundsChange,
    onLanePress,
    centerRequest = 0,
    fitRequest = 0,
    tracked = [],
    routes = [],
  } = props;
  const camera = useRef<CameraRef>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const location =
    props.currentLocation ?? (props.showUser ? tracked.at(-1) : null);
  const centered = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const historic = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: routes
        .filter(
          (r) =>
            !r.isDemo &&
            r.coordinates.length >= 2 &&
            r.coordinates.every(validCoordinate),
        )
        .map((r) => ({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: r.coordinates.map(toPosition),
          },
        })),
    }),
    [routes],
  );
  const track = useMemo<Feature<LineString> | null>(
    () =>
      tracked.length >= 2 && tracked.every(validCoordinate)
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: tracked.map(toPosition),
            },
          }
        : null,
    [tracked],
  );
  const routeFeature = useMemo(
    () =>
      geometry ? { type: "Feature" as const, properties: {}, geometry } : null,
    [geometry],
  );
  const fit = () => {
    const points = geometryPoints(geometry);
    if (!points.length) {
      if (origin) points.push(toPosition(origin));
      if (destination) points.push(toPosition(destination));
    }
    const bounds = boundsOf(
      points.length
        ? points
        : historic.features.flatMap(
            (f) => f.geometry.coordinates as [number, number][],
          ),
    );
    if (bounds) {
      if (bounds[0] === bounds[2] && bounds[1] === bounds[3])
        camera.current?.flyTo({
          center: [bounds[0], bounds[1]],
          zoom: 15,
          duration: 650,
        });
      else
        camera.current?.fitBounds(bounds, {
          padding: { top: 55, bottom: 55, left: 35, right: 35 },
          duration: 650,
        });
    }
  };
  useEffect(() => {
    setReady(false);
    setError("");
    centered.current = false;
    timer.current = setTimeout(
      () =>
        setError(
          "El mapa base no respondió. Comprueba tu conexión e inténtalo de nuevo.",
        ),
      20000,
    );
    return () => clearTimeout(timer.current);
  }, [attempt]);
  // Centrar en la primera posición y por acción explícita, sin seguir al GPS durante el paneo.
  useEffect(() => {
    if (ready && location && !centered.current) {
      camera.current?.flyTo({
        center: toPosition(location),
        zoom: 15,
        duration: 700,
      });
      centered.current = true;
    }
  }, [ready, location]);
  useEffect(() => {
    if (ready && location && centerRequest)
      camera.current?.flyTo({
        center: toPosition(location),
        zoom: 15,
        duration: 650,
      });
  }, [ready, centerRequest]);
  useEffect(() => {
    if (ready) fit();
  }, [ready, geometry, fitRequest]);
  useEffect(() => {
    if (ready && destination && !geometry)
      camera.current?.easeTo({
        center: toPosition(destination),
        zoom: 15,
        duration: 500,
      });
  }, [ready, destination]);
  return (
    <View style={[styles.mapFrame, fill ? { flex: 1 } : { height }]}>
      <MapLibreMap
        key={attempt}
        style={{ flex: 1 }}
        mapStyle={styleUrl}
        androidView="texture"
        attribution
        compass
        attributionPosition={{ bottom: 30, left: 8 }}
        onDidFinishLoadingMap={() => {
          clearTimeout(timer.current);
          setReady(true);
          setError("");
        }}
        onDidFailLoadingMap={() => {
          clearTimeout(timer.current);
          setReady(false);
          setError(
            "No se pudo cargar el mapa de MapTiler. Revisa la conexión y la configuración del mapa.",
          );
        }}
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          const point = { latitude, longitude };
          if (validCoordinate(point)) onPick?.(point);
        }}
        onLongPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          const point = { latitude, longitude };
          if (validCoordinate(point)) onPick?.(point);
        }}
        onRegionDidChange={(event) =>
          onBoundsChange?.(event.nativeEvent.bounds)
        }
      >
        <Camera ref={camera} initialViewState={{ center: [0, 0], zoom: 1 }} />
        {infrastructure && (
          <GeoJSONSource
            id="osm-cycleways"
            data={infrastructure}
            onPress={(event) => {
              event.stopPropagation();
              const id = event.nativeEvent.features[0]?.id;
              const feature = infrastructure.features.find((f) => f.id === id);
              if (feature) onLanePress?.(feature);
            }}
          >
            <Layer
              id="cycleways-exclusive"
              type="line"
              filter={[
                "in",
                ["get", "kind"],
                ["literal", ["cycleway", "track"]],
              ]}
              paint={{ "line-color": colors.greenDark, "line-width": 5 }}
            />
            <Layer
              id="cycleways-lanes"
              type="line"
              filter={["==", ["get", "kind"], "lane"]}
              paint={{
                "line-color": "#608D20",
                "line-width": 4,
                "line-dasharray": [3, 1],
              }}
            />
            <Layer
              id="cycleways-shared"
              type="line"
              filter={[
                "in",
                ["get", "kind"],
                ["literal", ["shared", "designated"]],
              ]}
              paint={{
                "line-color": "#99701C",
                "line-width": 3,
                "line-dasharray": [1, 2],
              }}
            />
          </GeoJSONSource>
        )}
        {!!historic.features.length && (
          <GeoJSONSource id="verified-routes" data={historic}>
            <Layer
              id="verified-routes-line"
              type="line"
              paint={{ "line-color": colors.black, "line-width": 4 }}
            />
          </GeoJSONSource>
        )}
        {routeFeature && (
          <GeoJSONSource id="planned-route" data={routeFeature}>
            <Layer
              id="planned-route-outline"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": colors.white, "line-width": 9 }}
            />
            <Layer
              id="planned-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": colors.black, "line-width": 5 }}
            />
          </GeoJSONSource>
        )}
        {track && (
          <GeoJSONSource id="recorded-track" data={track}>
            <Layer
              id="recorded-track-line"
              type="line"
              paint={{ "line-color": colors.greenDark, "line-width": 5 }}
            />
          </GeoJSONSource>
        )}
        {location && validCoordinate(location) && (
          <Marker id="current-location" lngLat={toPosition(location)}>
            <View
              accessibilityLabel="Tu ubicación actual"
              style={styles.location}
            />
          </Marker>
        )}
        {origin && (
          <Marker id="origin" anchor="bottom" lngLat={toPosition(origin)}>
            <View style={styles.pin}>
              <Text style={styles.pinText}>A</Text>
            </View>
          </Marker>
        )}
        {destination && (
          <Marker
            id="destination"
            anchor="bottom"
            lngLat={toPosition(destination)}
          >
            <View style={[styles.pin, { backgroundColor: colors.black }]}>
              <Text style={[styles.pinText, { color: colors.white }]}>B</Text>
            </View>
          </Marker>
        )}
      </MapLibreMap>
      {!ready && !error && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.greenDark} />
          <Text>Cargando mapa…</Text>
        </View>
      )}
      {!!error && (
        <View style={styles.error}>
          <Text style={{ color: colors.black }}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((v) => v + 1)}
            style={styles.retry}
          >
            <Text>Reintentar mapa</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.attribution}>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL("https://www.maptiler.com/copyright/")
          }
        >
          <Text style={styles.credit}>© MapTiler</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL("https://www.openstreetmap.org/copyright")
          }
        >
          <Text style={styles.credit}>© OpenStreetMap contributors</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  mapFrame: { overflow: "hidden", backgroundColor: "#EAF0E6" },
  loading: {
    position: "absolute",
    top: 12,
    left: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    gap: 10,
  },
  error: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    padding: 16,
    gap: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 10,
  },
  location: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#196FC2",
    borderWidth: 3,
    borderColor: colors.white,
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinText: { fontSize: 14, fontWeight: "900", color: colors.black },
  attribution: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    backgroundColor: "#FFFFFFED",
    padding: 5,
  },
  credit: { fontSize: 10, color: colors.black },
});
