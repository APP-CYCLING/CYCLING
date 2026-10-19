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
  type StyleSpecification,
  type InitialViewState,
} from "@maplibre/maplibre-react-native";
import type { FeatureCollection, Feature, LineString } from "geojson";
import {
  CycleInfrastructureLayers,
  CyclewaySymbols,
} from "./CycleInfrastructureLayers";
import type { CyclingMapProps } from "../types/map.types";
import {
  boundsOf,
  contextBounds,
  geometryPoints,
  toPosition,
  validCoordinate,
} from "../utils/geometry";
import { colors } from "../../../shared/theme/colors";
import { loadNativeMapStyle } from "../services/map-style.service";

export function NativeCyclingMap(props: CyclingMapProps) {
  const {
    height = 330,
    fill,
    origin,
    destination,
    stopPosition,
    geometry,
    infrastructure,
    onPick,
    onBoundsChange,
    onLanePress,
    centerRequest = 0,
    fitRequest = 0,
    initialFocus = "route",
    tracked = [],
    routes = [],
  } = props;
  const camera = useRef<CameraRef>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);
  const labelLayerId = mapStyle?.layers.find(
    (layer) => layer.type === "symbol",
  )?.id;
  const location =
    props.currentLocation !== undefined
      ? props.currentLocation
      : props.showUser
        ? tracked.at(-1)
        : null;
  // Capturar la ubicación disponible al montar el mapa, sin reiniciar la
  // cámara con cada fix posterior (el seguimiento se coordina en los efectos).
  const initialView = useMemo<InitialViewState>(
    () =>
      location
        ? { center: toPosition(location), zoom: 15 }
        : geometryPoints(geometry).length
          ? { center: geometryPoints(geometry)[0], zoom: 14 }
          : tracked.length
            ? { center: toPosition(tracked[0]), zoom: 14 }
            : { center: [0, 0], zoom: 1 },
    [mapStyle, attempt],
  );
  const centered = useRef(false),
    wasNavigating = useRef(false),
    userInteracted = useRef(false),
    lastCenterRequest = useRef(0),
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
    const points = [
      ...geometryPoints(geometry),
      ...tracked.filter(validCoordinate).map(toPosition),
    ];
    if (stopPosition && validCoordinate(stopPosition))
      points.push(toPosition(stopPosition));
    if (!points.length) {
      if (origin) points.push(toPosition(origin));
      if (destination) points.push(toPosition(destination));
    }
    const bounds = (
      props.minimumSpan
        ? (p: [number, number][]) => contextBounds(p, props.minimumSpan)
        : boundsOf
    )(
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
          padding: props.fitPadding ?? {
            top: 55,
            bottom: 55,
            left: 35,
            right: 35,
          },
          duration: 650,
        });
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setMapStyle(null);
    setReady(false);
    setError("");
    centered.current = false;
    userInteracted.current = false;
    timer.current = setTimeout(() => {
      controller.abort();
      setError(
        "El mapa base no respondió. Comprueba tu conexión e inténtalo de nuevo.",
      );
    }, 20000);
    loadNativeMapStyle(controller.signal)
      .then((style) => {
        if (current && !controller.signal.aborted) setMapStyle(style);
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          clearTimeout(timer.current);
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo preparar el mapa.",
          );
        }
      });
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer.current);
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready) return;
    if (wasNavigating.current && !props.navigationMode)
      camera.current?.zoomTo(15, {
        pitch: 0,
        bearing: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 0,
      });
    wasNavigating.current = !!props.navigationMode;
  }, [ready, props.navigationMode]);
  // Centrar en la primera posición y por acción explícita, sin seguir al GPS durante el paneo.
  useEffect(() => {
    if (props.navigationMode || props.followLocation) return;
    if (
      ready &&
      location &&
      (!centered.current ||
        (!userInteracted.current && !geometry && !destination))
    ) {
      camera.current?.flyTo({
        center: toPosition(location),
        zoom: 15,
        duration: 700,
      });
      centered.current = true;
    }
  }, [
    ready,
    location,
    geometry,
    destination,
    props.followLocation,
    props.navigationMode,
  ]);
  useEffect(() => {
    if (ready && location && props.followLocation) {
      camera.current?.easeTo({
        center: toPosition(location),
        zoom: 17,
        pitch: 40,
        bearing: props.navigationBearing ?? 0,
        padding: {
          top: props.navigationTopInset ?? 150,
          bottom: 36,
          left: 16,
          right: 16,
        },
        duration: 800,
      });
    }
  }, [
    ready,
    location,
    props.followLocation,
    props.navigationBearing,
    props.navigationTopInset,
  ]);
  useEffect(() => {
    if (ready && location && centerRequest !== lastCenterRequest.current) {
      userInteracted.current = false;
      camera.current?.flyTo({
        center: toPosition(location),
        zoom: props.followLocation ? 17 : 15,
        pitch: props.followLocation ? 40 : 0,
        bearing: props.followLocation ? (props.navigationBearing ?? 0) : 0,
        padding: props.followLocation
          ? {
              top: props.navigationTopInset ?? 150,
              bottom: 36,
              left: 16,
              right: 16,
            }
          : { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 650,
      });
      lastCenterRequest.current = centerRequest;
    }
  }, [ready, centerRequest, location]);
  useEffect(() => {
    if (ready && (initialFocus === "route" || fitRequest > 0)) fit();
  }, [ready, geometry, fitRequest, initialFocus, props.fitPadding]);
  useEffect(() => {
    if (ready && destination && !geometry && initialFocus === "route")
      camera.current?.easeTo({
        center: toPosition(destination),
        zoom: 15,
        duration: 500,
      });
  }, [ready, destination]);
  return (
    <View style={[styles.mapFrame, fill ? { flex: 1 } : { height }]}>
      {mapStyle && (
        <MapLibreMap
          key={attempt}
          style={{ flex: 1 }}
          mapStyle={mapStyle}
          androidView="texture"
          attribution
          compass
          attributionPosition={{ bottom: 30, left: 8 }}
          onDidFinishLoadingStyle={() => {
            // El estilo ya permite usar la cámara. No esperar a todas las
            // teselas de la vista mundial inicial para centrar el GPS.
            clearTimeout(timer.current);
            setReady(true);
            setError("");
          }}
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
            userInteracted.current = true;
            const [longitude, latitude] = event.nativeEvent.lngLat;
            const point = { latitude, longitude };
            if (validCoordinate(point)) onPick?.(point);
          }}
          onLongPress={(event) => {
            userInteracted.current = true;
            const [longitude, latitude] = event.nativeEvent.lngLat;
            const point = { latitude, longitude };
            if (validCoordinate(point)) onPick?.(point);
          }}
          onRegionWillChange={(event) => {
            if (event.nativeEvent.userInteraction) {
              userInteracted.current = true;
              props.onFollowChange?.(false);
            }
          }}
          onRegionDidChange={(event) =>
            onBoundsChange?.(event.nativeEvent.bounds)
          }
        >
          <Camera ref={camera} initialViewState={initialView} />
          {infrastructure && (
            <CycleInfrastructureLayers
              data={infrastructure}
              onPress={onLanePress}
              beforeId={labelLayerId}
            />
          )}
          {!!props.alternativeGeometries?.length && (
            <GeoJSONSource
              id="route-alternatives"
              data={{
                type: "FeatureCollection",
                features: props.alternativeGeometries.map(
                  (geometry, index) => ({
                    type: "Feature",
                    id: index,
                    properties: {},
                    geometry,
                  }),
                ),
              }}
            >
              <Layer
                id="route-alternatives-line"
                beforeId={labelLayerId}
                type="line"
                paint={{
                  "line-color": "#5C84AC",
                  "line-width": 3,
                  "line-opacity": 0.45,
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
                beforeId={labelLayerId}
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#FFFFFF", "line-width": 5 }}
              />
              <Layer
                id="planned-route-line"
                beforeId={labelLayerId}
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#2379D2", "line-width": 3 }}
              />
            </GeoJSONSource>
          )}
          {infrastructure && <CyclewaySymbols />}
          {track && (
            <GeoJSONSource id="recorded-track" data={track}>
              <Layer
                id="recorded-track-line"
                type="line"
                paint={{ "line-color": "#176EAC", "line-width": 5 }}
              />
            </GeoJSONSource>
          )}
          {location && validCoordinate(location) && (
            <Marker id="current-location" lngLat={toPosition(location)}>
              <View
                accessibilityLabel="Tu ubicación actual"
                style={[
                  styles.location,
                  props.followLocation && {
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                {props.followLocation && (
                  <Text style={{ color: colors.white, fontSize: 13 }}>▲</Text>
                )}
              </View>
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
          {stopPosition && validCoordinate(stopPosition) && (
            <Marker
              id="ride-stop"
              anchor="bottom"
              lngLat={toPosition(stopPosition)}
            >
              <View
                accessibilityLabel={props.stopLabel ?? "Fin GPS"}
                style={[styles.pin, { backgroundColor: "#D57625" }]}
              >
                <Text style={[styles.pinText, { color: colors.white }]}>F</Text>
              </View>
            </Marker>
          )}
        </MapLibreMap>
      )}
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
    backgroundColor: colors.black,
    borderWidth: 3,
    borderColor: colors.green,
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
