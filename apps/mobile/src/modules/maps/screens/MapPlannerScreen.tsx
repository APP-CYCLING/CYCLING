import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useScreenFocused } from "../../../shared/hooks/useScreenFocused";
import type {
  Bounds,
  Coordinate,
  Destination,
  LaneFeature,
  LaneKind,
} from "@cycling/contracts";
import { CyclingMap } from "../components/CyclingMap";
import { useUserLocation } from "../../geolocation/hooks/useUserLocation";
import { useRoutePlanner } from "../../route-planner/hooks/useRoutePlanner";
import { useDestinationSearch } from "../../route-planner/hooks/useDestinationSearch";
import { useVisibleBikeLanes } from "../../bike-lanes/hooks/useVisibleBikeLanes";
import { useAuth } from "../../auth/context/AuthContext";
import { setPlannedRide } from "../../navigation/services/planned-ride.store";
import { PrimaryButton } from "../../../shared/components/UI";
import { colors } from "../../../shared/theme/colors";

const kindLabel: Record<LaneKind, string> = {
  cycleway: "Vía ciclista (OSM)",
  track: "Pista separada",
  lane: "Carril ciclista",
  shared: "Carril compartido",
  designated: "Uso ciclista designado; separación no confirmada",
};
const pointLabel = (p: Coordinate) =>
  `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
export function MapPlannerScreen() {
  const { user } = useAuth();
  return <PlannerContent key={user?.id ?? "guest"} />;
}
function PlannerContent() {
  const { user } = useAuth(),
    focused = useScreenFocused(),
    gps = useUserLocation();
  const [origin, setOrigin] = useState<Coordinate | null>(null),
    [target, setTarget] = useState<"origin" | "destination">("origin");
  const [query, setQuery] = useState(""),
    [bounds, setBounds] = useState<Bounds | null>(null),
    [showLanes, setShowLanes] = useState(true);
  const [centerRequest, setCenterRequest] = useState(0),
    [fitRequest, setFitRequest] = useState(0),
    [lane, setLane] = useState<LaneFeature | null>(null);
  const planner = useRoutePlanner(origin);
  const search = useDestinationSearch(
    query,
    origin ?? gps.position,
    !!user && !planner.destination && focused,
  );
  const lanes = useVisibleBikeLanes(bounds, showLanes && !!user && focused);
  useEffect(() => {
    if (gps.position && !origin) {
      setOrigin(gps.position);
      setTarget("destination");
    }
  }, [gps.position, origin]);
  const select = (destination: Destination) => {
    planner.select(destination);
    setQuery(destination.label);
    setTarget("destination");
    setLane(null);
    Keyboard.dismiss();
  };
  const pick = (point: Coordinate) => {
    Keyboard.dismiss();
    setLane(null);
    if (target === "origin" || !origin) {
      setOrigin(point);
      planner.cancel();
      setTarget("destination");
    } else
      select({
        id: `map:${point.longitude},${point.latitude}`,
        label: `Punto en el mapa · ${pointLabel(point)}`,
        coordinate: point,
      });
  };
  const locate = () => {
    if (gps.position) {
      setCenterRequest((value) => value + 1);
      return;
    }
    gps.request();
  };
  const begin = () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!origin || !planner.route || !planner.destination) return;
    setPlannedRide({
      origin,
      route: planner.route,
      destination: planner.destination,
      userId: user.id,
    });
    router.push({
      pathname: "/ride",
      params: { start: Date.now().toString() },
    });
  };
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.header}>
        <Text style={s.eyebrow}>EXPLORA A TU RITMO</Text>
        <View style={s.search}>
          <Ionicons name="search-outline" size={21} color={colors.greenDark} />
          <TextInput
            accessibilityLabel="Buscar destino"
            placeholder="¿A dónde vamos hoy?"
            placeholderTextColor={colors.muted}
            value={query}
            maxLength={200}
            style={s.input}
            onChangeText={(text) => {
              setQuery(text);
              if (planner.destination) planner.select(null);
            }}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.loading ? (
            <ActivityIndicator color={colors.greenDark} />
          ) : (
            !!query && (
              <Pressable
                accessibilityLabel="Limpiar destino"
                accessibilityRole="button"
                style={s.clear}
                onPress={() => {
                  setQuery("");
                  planner.select(null);
                }}
              >
                <Ionicons name="close" size={21} />
              </Pressable>
            )
          )}
        </View>
        {!!search.suggestions.length && (
          <ScrollView keyboardShouldPersistTaps="handled" style={s.results}>
            {search.suggestions.map((result) => (
              <Pressable
                key={result.id}
                accessibilityRole="button"
                onPress={() => select(result)}
                style={s.result}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.greenDark}
                />
                <Text style={{ flex: 1, color: colors.black }}>
                  {result.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!!search.error && (
          <Text accessibilityRole="alert" style={s.error}>
            {search.error}
          </Text>
        )}
        <View style={s.originRow}>
          <Text style={s.originText} numberOfLines={1}>
            A · {origin ? pointLabel(origin) : "Selecciona tu origen"}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.smallButton}
            onPress={() => {
              setTarget("origin");
              planner.cancel();
              Keyboard.dismiss();
            }}
          >
            <Text style={s.smallLabel}>Cambiar origen</Text>
          </Pressable>
        </View>
        <Text style={s.hint}>
          {target === "origin"
            ? "Toca el mapa para elegir el origen."
            : "Toca el mapa o busca un destino."}
        </Text>
      </View>
      <View style={s.map}>
        <CyclingMap
          fill
          currentLocation={gps.position}
          origin={origin}
          destination={planner.destination?.coordinate}
          geometry={planner.route?.geometry}
          infrastructure={lanes.data}
          centerRequest={centerRequest}
          fitRequest={fitRequest}
          onPick={pick}
          onBoundsChange={setBounds}
          onLanePress={setLane}
        />
        <View style={s.controls}>
          <MapControl
            label="Centrar mi ubicación"
            icon="locate-outline"
            onPress={locate}
            busy={gps.loading}
          />
          <MapControl
            label={showLanes ? "Ocultar ciclovías" : "Mostrar ciclovías"}
            icon="bicycle-outline"
            active={showLanes}
            onPress={() => {
              setShowLanes((value) => !value);
              setLane(null);
            }}
          />
          <MapControl
            label="Cambiar destino"
            icon="flag-outline"
            onPress={() => {
              setTarget("destination");
              planner.select(null);
              setQuery("");
            }}
          />
          <MapControl
            label="Ajustar mapa a la ruta"
            icon="expand-outline"
            onPress={() => setFitRequest((value) => value + 1)}
          />
        </View>
      </View>
      <ScrollView
        style={s.panel}
        contentContainerStyle={s.panelContent}
        keyboardShouldPersistTaps="handled"
      >
        {!gps.position && (
          <Pressable
            accessibilityRole="button"
            style={s.permission}
            onPress={gps.request}
            disabled={gps.loading}
          >
            <Ionicons
              name="navigate-outline"
              size={18}
              color={colors.greenDark}
            />
            <Text style={s.permissionText}>
              {gps.loading
                ? "Buscando ubicación…"
                : "Usar mi ubicación: permite GPS mientras exploras."}
            </Text>
          </Pressable>
        )}
        {!!gps.error && (
          <Text style={s.error} accessibilityRole="alert">
            {gps.error}
          </Text>
        )}
        {!user && (
          <Pressable
            accessibilityRole="button"
            style={s.permission}
            onPress={() => router.push("/auth")}
          >
            <Text style={s.permissionText}>
              Inicia sesión para buscar, consultar ciclovías y calcular tu ruta.
            </Text>
          </Pressable>
        )}
        {showLanes && !!user && (
          <Text style={s.hint}>
            {lanes.loading
              ? "Cargando infraestructura OSM…"
              : lanes.error ||
                `${lanes.data.features.length} tramos OSM en el área consultada.`}
          </Text>
        )}
        {showLanes && (
          <Text style={s.legend}>
            Verde: vía/pista ciclista · Verde discontinuo: carril · Ocre:
            compartido/designado · Negro: ruta
          </Text>
        )}
        {lane && (
          <View style={s.lane}>
            <Text style={s.destination}>{lane.properties.name}</Text>
            <Text>{kindLabel[lane.properties.kind]}</Text>
            <Text style={s.hint}>
              Superficie: {lane.properties.tags.surface ?? "sin datos"} ·
              Separación: {lane.properties.tags.segregated ?? "sin datos"}
            </Text>
          </View>
        )}
        {planner.destination && (
          <>
            <Text numberOfLines={2} style={s.destination}>
              B · {planner.destination.label}
            </Text>
            {planner.route && (
              <View style={s.metrics}>
                <Text style={s.metric}>
                  {(planner.route.distanceMeters / 1000).toFixed(1)} km
                </Text>
                <Text style={s.metric}>
                  ≈{" "}
                  {Math.max(1, Math.round(planner.route.durationSeconds / 60))}{" "}
                  min
                </Text>
                <Text style={s.mode}>Bicicleta</Text>
              </View>
            )}
            {!!planner.error && (
              <Text accessibilityRole="alert" style={s.error}>
                {planner.error}
              </Text>
            )}
            <PrimaryButton
              title={
                planner.loading
                  ? "Calculando ruta…"
                  : planner.route
                    ? "Recalcular ruta para bicicleta"
                    : "Calcular ruta para bicicleta"
              }
              disabled={planner.loading || !origin || target === "origin"}
              onPress={() => {
                Keyboard.dismiss();
                if (!user) router.push("/auth");
                else void planner.calculate();
              }}
            />
            {planner.route && (
              <PrimaryButton title="Comenzar recorrido" onPress={begin} />
            )}
            <Text style={s.hint}>
              La estimación depende de los datos disponibles. Revisa las
              condiciones y señales del lugar.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function MapControl({
  label,
  icon,
  onPress,
  active,
  busy,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  active?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, busy }}
      onPress={onPress}
      style={[s.control, active && { backgroundColor: colors.green }]}
    >
      {busy ? (
        <ActivityIndicator color={colors.greenDark} />
      ) : (
        <Ionicons name={icon} size={22} color={colors.black} />
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, gap: 7 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.greenDark,
  },
  search: {
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  input: { flex: 1, minHeight: 50, fontSize: 16, color: colors.black },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  results: { maxHeight: 150, backgroundColor: colors.white, borderRadius: 12 },
  result: {
    padding: 13,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  originRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  originText: { flex: 1, fontSize: 12, color: colors.black },
  smallButton: { minHeight: 44, justifyContent: "center" },
  smallLabel: { fontSize: 12, fontWeight: "700", color: colors.greenDark },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
  map: { flex: 1, minHeight: 180, position: "relative" },
  controls: { position: "absolute", top: 12, right: 12, gap: 8 },
  control: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    elevation: 3,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  panel: {
    maxHeight: 270,
    flexGrow: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  panelContent: { padding: 16, gap: 10 },
  permission: {
    minHeight: 44,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  permissionText: {
    flex: 1,
    color: colors.greenDark,
    fontWeight: "600",
    lineHeight: 20,
  },
  error: { fontSize: 12, color: "#963B25", lineHeight: 18 },
  legend: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  lane: {
    padding: 10,
    backgroundColor: colors.softGreen,
    borderRadius: 10,
    gap: 5,
  },
  destination: { fontWeight: "800", fontSize: 15, color: colors.black },
  metrics: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  metric: { fontSize: 23, fontWeight: "900", color: colors.black },
  mode: {
    fontSize: 12,
    color: colors.greenDark,
    backgroundColor: colors.softGreen,
    borderRadius: 8,
    padding: 6,
  },
});
