import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { LaneKind } from "@cycling/contracts";
import {
  RouteAlternativesSelector,
  RouteSelectionSummary,
} from "../../route-planner/components/RouteAlternativesSelector";
import { CyclingMap } from "./CyclingMap";
import type { useMapPlanner } from "../hooks/useMapPlanner";
import {
  AppText,
  Chip,
  IconButton,
  ScreenHeader,
} from "../../../shared/components/DesignSystem";
import { Notice, PrimaryButton } from "../../../shared/components/UI";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
import { fonts } from "../../../shared/theme/typography";
import { useFontFamily } from "../../../shared/theme/FontContext";
type Props = { controller: ReturnType<typeof useMapPlanner> };
const labels: Record<LaneKind, string> = {
  unknown: "Infraestructura sin confirmar",
  cycleway: "Vía ciclista (OSM)",
  track: "Pista separada",
  lane: "Carril ciclista",
  shared: "Carril compartido",
  designated: "Uso ciclista designado; separación no confirmada",
};
export function PlannerLayout({ controller: c }: Props) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const fontFamily = useFontFamily();
  const { height } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(height - 140);
  const mapAndSheetHeight = Math.max(160, layoutHeight - 66);
  const planning = !!c.planner.destination;
  const fitPadding = useMemo(
    () => ({
      top: 100,
      bottom: c.planner.optionsOpen ? Math.max(55, height * 0.22) : 55,
      left: 30,
      right: 30,
    }),
    [c.planner.optionsOpen, height],
  );
  const alternativeGeometries = useMemo(
    () =>
      c.planner.alternatives?.options
        .filter((option) => !option.modes.includes(c.planner.selectedRouteMode))
        .map((option) => option.route.geometry),
    [c.planner.alternatives, c.planner.selectedRouteMode],
  );
  const startSelected = c.begin;
  const clear = () => {
    c.setQuery("");
    c.planner.select(null);
    c.setTarget("destination");
  };
  const originLabel = c.planner.routeOrigin
    ? "Origen de esta ruta"
    : c.originMode === "manual"
      ? "Punto elegido en el mapa"
      : c.gps.position
        ? c.gps.status === "approximate"
          ? "Mi ubicación aproximada"
          : "Mi ubicación actual"
        : c.gps.loading
          ? "Buscando mi ubicación…"
          : "Ubicación no disponible";
  return (
    <KeyboardAvoidingView
      style={s.screen}
      onLayout={(event) => setLayoutHeight(event.nativeEvent.layout.height)}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title={planning ? "Planificar ruta" : "Explorar"}
        back={planning ? clear : undefined}
      />
      <View
        style={[
          s.mapArea,
          { minHeight: Math.min(150, mapAndSheetHeight * 0.4) },
        ]}
      >
        <CyclingMap
          fill
          currentLocation={c.gps.position}
          origin={c.displayedOrigin}
          destination={c.planner.destination?.coordinate}
          geometry={c.planner.route?.geometry}
          alternativeGeometries={alternativeGeometries}
          infrastructure={c.lanes.data}
          centerRequest={c.centerRequest}
          fitRequest={c.fitRequest}
          fitPadding={fitPadding}
          onPick={c.pick}
          onBoundsChange={c.setBounds}
          onLanePress={c.setLane}
        />
        <View style={s.searchOverlay}>
          <View style={s.search}>
            <Ionicons
              name="search-outline"
              size={21}
              color={colors.greenDark}
            />
            <TextInput
              accessibilityLabel="Buscar destino"
              placeholder="¿A dónde vamos hoy?"
              placeholderTextColor={colors.muted}
              value={c.query}
              maxLength={200}
              style={[s.input, { fontFamily }]}
              onChangeText={(text) => {
                c.setQuery(text);
                if (c.planner.destination) c.planner.select(null);
              }}
              autoCorrect={false}
              returnKeyType="search"
            />
            {c.search.loading ? (
              <ActivityIndicator color={colors.greenDark} />
            ) : (
              !!c.query && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar destino"
                  style={s.clear}
                  onPress={clear}
                >
                  <Ionicons name="close" size={21} color={colors.muted} />
                </Pressable>
              )
            )}
          </View>
          {!!c.search.suggestions.length && (
            <ScrollView style={s.results} keyboardShouldPersistTaps="handled">
              {c.search.suggestions.map((result) => (
                <Pressable
                  key={result.id}
                  accessibilityRole="button"
                  onPress={() => c.select(result)}
                  style={s.result}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={colors.greenDark}
                  />
                  <AppText style={{ flex: 1, fontSize: 13 }}>
                    {result.label}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {!!c.search.error && <Notice message={c.search.error} />}
          {planning && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip
                icon="bicycle-outline"
                label="Mostrar ciclovías"
                active={c.showLanes}
                onPress={() => {
                  c.setShowLanes(!c.showLanes);
                  c.setLane(null);
                }}
              />
              <Chip
                icon="pin-outline"
                label="Cambiar origen"
                active={c.target === "origin"}
                onPress={() => {
                  c.setTarget("origin");
                  c.planner.cancel();
                  Keyboard.dismiss();
                }}
              />
            </View>
          )}
          {!!c.search.error && (
            <PrimaryButton
              title="Reintentar búsqueda"
              outline
              onPress={c.search.retry}
            />
          )}
          {!planning && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Chip
                icon="bicycle-outline"
                label="Mostrar ciclovías"
                active={c.showLanes}
                onPress={() => {
                  c.setShowLanes(!c.showLanes);
                  c.setLane(null);
                }}
              />
              <Chip
                icon="locate-outline"
                label="Origen GPS"
                active={c.originMode === "gps" && c.target !== "origin"}
                onPress={c.locate}
              />
              <Chip
                icon="pin-outline"
                label="Elegir origen"
                active={c.target === "origin"}
                onPress={() => {
                  c.setTarget("origin");
                  c.planner.cancel();
                  Keyboard.dismiss();
                }}
              />
            </ScrollView>
          )}
        </View>
        <View style={s.controls}>
          <IconButton
            icon="layers-outline"
            label={c.showLanes ? "Ocultar ciclovías" : "Mostrar ciclovías"}
            active={c.showLanes}
            onPress={() => {
              c.setShowLanes(!c.showLanes);
              c.setLane(null);
            }}
          />
          {planning && (
            <IconButton
              icon="expand-outline"
              label="Ajustar mapa a la ruta"
              onPress={() => c.setFitRequest((value) => value + 1)}
            />
          )}
          <IconButton
            dark
            icon="locate"
            label="Centrar mi ubicación"
            onPress={c.locate}
          />
        </View>
      </View>
      <ScrollView
        style={[
          s.sheet,
          {
            maxHeight:
              mapAndSheetHeight *
              (planning ? (c.planner.route ? 0.32 : 0.46) : 0.42),
          },
        ]}
        contentContainerStyle={s.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.handle} />
        {planning ? (
          <>
            {!c.planner.route && (
              <View style={s.waypoints}>
                <View style={s.pointRow}>
                  <View style={s.originDot} />
                  <AppText weight="medium" style={{ flex: 1, fontSize: 12 }}>
                    {originLabel}
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      c.setTarget("origin");
                      c.planner.cancel();
                      Keyboard.dismiss();
                    }}
                    style={s.clear}
                  >
                    <AppText
                      weight="bold"
                      style={{ color: colors.greenDark, fontSize: 11 }}
                    >
                      Cambiar
                    </AppText>
                  </Pressable>
                </View>
                <View style={s.connector} />
                <View style={s.pointRow}>
                  <Ionicons
                    name="location"
                    size={19}
                    color={colors.greenDark}
                  />
                  <AppText
                    numberOfLines={2}
                    weight="bold"
                    style={{ flex: 1, fontSize: 13 }}
                  >
                    {c.planner.destination?.label}
                  </AppText>
                </View>
              </View>
            )}
            {c.planner.route && (
              <RouteSelectionSummary
                route={c.planner.route}
                mode={c.planner.selectedRouteMode}
              />
            )}
            {!!c.planner.error && <Notice message={c.planner.error} />}
            {c.planner.route ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Cambiar ruta"
                      outline
                      onPress={c.planner.openOptions}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Iniciar ruta →"
                      onPress={startSelected}
                      disabled={
                        c.planner.optionStates[c.planner.selectedRouteMode]
                          .status !== "ready"
                      }
                    />
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={c.planner.loading || !c.origin}
                  onPress={() => void c.planner.calculate()}
                  style={{
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText
                    weight="bold"
                    style={{ color: colors.greenDark, fontSize: 12 }}
                  >
                    {c.planner.loading
                      ? "Completando alternativas…"
                      : "Recalcular desde el origen actual"}
                  </AppText>
                </Pressable>
              </>
            ) : (
              <PrimaryButton
                title={
                  c.planner.loading ? "Calculando ruta…" : "Encontrar mi ruta →"
                }
                disabled={
                  c.planner.loading || !c.origin || c.target === "origin"
                }
                onPress={() => {
                  Keyboard.dismiss();
                  if (!c.user) router.push("/auth");
                  else void c.planner.calculate();
                }}
              />
            )}
            <AppText style={s.caption}>
              La estimación depende de los datos disponibles. Revisa las
              condiciones y señales del lugar.
            </AppText>
          </>
        ) : (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name="navigate-circle"
                color={colors.greenDark}
                size={22}
              />
              <AppText weight="bold" style={{ fontSize: 17, flex: 1 }}>
                {c.target === "origin"
                  ? "Elige tu punto de partida"
                  : "Descubre tu próxima ruta"}
              </AppText>
            </View>
            <AppText style={s.caption}>
              {c.target === "origin"
                ? "Toca el mapa para elegir el origen."
                : "Busca un destino o selecciónalo en el mapa."}
            </AppText>
            <Chip
              icon="locate-outline"
              label={originLabel}
              active
              onPress={c.locate}
            />
          </>
        )}
        {!c.gps.position && (
          <Pressable
            accessibilityRole="button"
            disabled={c.gps.loading}
            onPress={c.gps.request}
            style={s.locationRetry}
          >
            {c.gps.loading && <ActivityIndicator color={colors.greenDark} />}
            <AppText weight="medium" style={{ color: colors.greenDark }}>
              {c.gps.loading
                ? "Buscando ubicación…"
                : "Reintentar mi ubicación"}
            </AppText>
          </Pressable>
        )}
        {!!c.gps.error && <Notice message={c.gps.error} />}
        {(
          ["denied", "approximate", "disabled", "timeout", "error"] as string[]
        ).includes(c.gps.status) && (
          <PrimaryButton
            title="Abrir ajustes de ubicación"
            outline
            onPress={c.gps.openSettings}
          />
        )}
        {c.originMode === "manual" && (
          <PrimaryButton
            title="Usar mi ubicación como origen"
            outline
            onPress={c.locate}
          />
        )}
        {!c.user && (
          <PrimaryButton
            title="Iniciar sesión para planificar"
            outline
            onPress={() => router.push("/auth")}
          />
        )}
        {c.showLanes && (
          <>
            <AppText style={s.caption}>
              {c.lanes.loading
                ? "Cargando infraestructura OSM…"
                : (c.lanes.error
                    ? `Ciclovías: ${c.lanes.error}${c.planner.route ? " Tu ruta calculada sigue disponible." : ""}`
                    : "") ||
                  (c.user
                    ? `${c.lanes.data.features.length} tramos OSM en el área consultada.`
                    : "Inicia sesión para consultar ciclovías.")}
            </AppText>
            {!!c.lanes.error && c.lanes.canRetry && (
              <PrimaryButton
                title="Reintentar ciclovías"
                outline
                onPress={c.lanes.retry}
              />
            )}
            <AppText style={s.legend}>
              Verde/amarillo: segregada · Verde discontinuo: carril · Ocre:
              compartida · Gris: sin confirmar · Azul: ruta
            </AppText>
          </>
        )}
        {c.lane && (
          <View style={s.waypoints}>
            <AppText weight="bold">{c.lane.properties.name}</AppText>
            <AppText>
              {c.lane.properties.infrastructure === "shared"
                ? "Vía compartida; no es una ciclovía exclusiva"
                : c.lane.properties.infrastructure === "unknown"
                  ? "Infraestructura sin confirmar"
                  : labels[c.lane.properties.kind]}
            </AppText>
            {c.lane.properties.geometryBasis === "visual_offset" && (
              <AppText style={s.caption}>
                Desplazamiento visual según el lado OSM; no es una geometría
                física independiente.
              </AppText>
            )}
            {c.lane.properties.geometryBasis === "attribute" && (
              <AppText style={s.caption}>
                OSM registra un atributo de la calle sin geometría o lado
                suficiente para localizar la infraestructura con precisión.
              </AppText>
            )}
            <AppText style={s.caption}>
              Superficie: {c.lane.properties.tags.surface ?? "sin datos"} ·
              Separación: {c.lane.properties.tags.segregated ?? "sin datos"}
            </AppText>
          </View>
        )}
      </ScrollView>
      <RouteAlternativesSelector
        visible={c.planner.optionsOpen}
        onClose={c.planner.closeOptions}
        alternatives={c.planner.alternatives}
        selected={c.planner.route}
        selectedMode={c.planner.selectedRouteMode}
        optionStates={c.planner.optionStates}
        onSelect={(id) => {
          c.planner.selectAlternative(id);
          c.setFitRequest((value) => value + 1);
        }}
        onStart={startSelected}
      />
    </KeyboardAvoidingView>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    mapArea: { flex: 1, minHeight: 150 },
    searchOverlay: {
      position: "absolute",
      top: 14,
      left: 16,
      right: 16,
      gap: 10,
    },
    search: {
      minHeight: 54,
      borderRadius: 30,
      backgroundColor: colors.surface,
      paddingLeft: 18,
      paddingRight: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      elevation: 3,
      boxShadow: "0px 3px 14px #15191512",
    },
    input: {
      flex: 1,
      minHeight: 54,
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.text,
    },
    clear: {
      minHeight: 44,
      minWidth: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    results: {
      maxHeight: 190,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    result: {
      padding: 14,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    controls: { position: "absolute", right: 16, bottom: 36, gap: 10 },
    sheet: {
      flexGrow: 0,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: colors.surface,
    },
    sheetContent: {
      padding: 20,
      paddingTop: 10,
      gap: 12,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    handle: {
      height: 4,
      width: 36,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 8,
    },
    waypoints: {
      backgroundColor: colors.surfaceLow,
      padding: 14,
      gap: 6,
      borderRadius: 20,
    },
    pointRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    originDot: {
      height: 12,
      width: 12,
      borderRadius: 6,
      borderWidth: 3,
      borderColor: colors.greenDark,
      marginHorizontal: 3,
    },
    connector: {
      height: 12,
      borderLeftWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.muted,
      marginLeft: 9,
    },
    metrics: {
      flexDirection: "row",
      gap: 4,
      backgroundColor: colors.surfaceLow,
      borderRadius: 20,
    },
    caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    legend: { color: colors.muted, fontSize: 10, lineHeight: 16 },
    locationRetry: {
      minHeight: 44,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
  });
