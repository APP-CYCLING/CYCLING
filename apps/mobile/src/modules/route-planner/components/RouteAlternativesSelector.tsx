import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type {
  RouteAlternatives,
  PlannedRoute,
  RouteMode,
  RouteOptionState,
} from "@cycling/contracts";
import { AppText } from "../../../shared/components/DesignSystem";
import { BrandLoader } from "../../../shared/components/BrandLoader";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
import { ElevationProfileButton, elevationLabel } from "./ElevationProfile";

export const routePresentation = {
  fast: {
    name: "Ruta R\u00e1pida",
    icon: "flash",
    color: "#F4CE43",
    description:
      "Llega en el menor tiempo posible, sin depender de ciclov\u00edas.",
  },
  cycleway_priority: {
    name: "Ruta Ciclista",
    icon: "bicycle",
    color: "#348DF4",
    description:
      "Prioriza ciclov\u00edas y conecta los tramos necesarios por calles.",
  },
  balanced: {
    name: "Ruta Equilibrada",
    icon: "git-branch-outline",
    color: "#A7F55B",
    description: "Combina un recorrido eficiente con el uso de ciclov\u00edas.",
  },
} as const;
const modes: RouteMode[] = ["fast", "cycleway_priority", "balanced"];
export function routeMetrics(route: PlannedRoute) {
  const coverage = route.coverage?.percent;
  return `\u2248 ${Math.max(1, Math.round(route.durationSeconds / 60))} min \u00b7 ${(route.distanceMeters / 1000).toFixed(2)} km \u00b7 D+ ${elevationLabel(route)} \u00b7 ${coverage == null ? "Ciclov\u00edas \u2014" : `${Math.round(coverage)} % ciclov\u00edas${route.coverage?.status === "estimated" ? "*" : ""}`}`;
}
export function RouteSelectionSummary({
  route,
  mode,
}: {
  route: PlannedRoute;
  mode: RouteMode;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 5 }}>
      <AppText weight="bold" style={{ color: colors.text, fontSize: 16 }}>
        {routePresentation[mode].name}
      </AppText>
      <AppText style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        {routeMetrics(route)}
      </AppText>
      <ElevationProfileButton route={route} />
    </View>
  );
}
export function RouteAlternativesSelector({
  alternatives,
  selected,
  selectedMode = selected?.mode ?? "fast",
  optionStates,
  visible = true,
  onClose = () => {},
  onSelect,
  onStart,
}: {
  alternatives: RouteAlternatives | null;
  selected: PlannedRoute | null;
  selectedMode?: RouteMode;
  optionStates?: Record<RouteMode, RouteOptionState>;
  visible?: boolean;
  onClose?: () => void;
  onSelect: (id: string) => void;
  onStart?: () => void;
}) {
  const { height } = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const loading =
    optionStates &&
    modes.some((mode) => optionStates[mode].status === "loading");
  const selectedReady =
    selected &&
    (!optionStates || optionStates[selectedMode].status === "ready");
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar opciones de ruta"
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#00000020",
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: height * 0.56,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: "#101713",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{
              height: 4,
              width: 38,
              borderRadius: 2,
              backgroundColor: "#526057",
              alignSelf: "center",
              marginTop: 9,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 18,
              minHeight: 48,
              gap: 12,
            }}
          >
            <AppText weight="bold" style={{ color: "#FFFFFF", fontSize: 18 }}>
              Opciones de ruta
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <AppText weight="bold" style={{ color: "#A7F55B", fontSize: 13 }}>
                Cerrar
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingBottom: 8,
              gap: 8,
            }}
            showsVerticalScrollIndicator
          >
            {modes.map((mode) => {
              const meta = routePresentation[mode],
                option = alternatives?.options.find((option) =>
                  option.modes.includes(mode),
                );
              const state = optionStates?.[mode] ?? {
                status: option ? "ready" : "unavailable",
                message: alternatives?.unavailable[mode],
              };
              const duplicate = option && option.modes[0] !== mode;
              const ready = !!option && state.status === "ready" && !duplicate;
              const active = ready && option.modes.includes(selectedMode);
              const reason = duplicate
                ? `Coincide con ${routePresentation[option.modes[0]].name}. No es otro trazado.`
                : state.message;
              const content = (
                <>
                  <View
                    style={{
                      width: 38,
                      height: 44,
                      borderRadius: 9,
                      backgroundColor: ready ? meta.color : "#364139",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={24}
                      color={ready ? "#101713" : "#B7C4BA"}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText
                      weight="bold"
                      style={{
                        color: ready ? "#FFFFFF" : "#B7C4BA",
                        fontSize: 14,
                      }}
                    >
                      {meta.name}
                    </AppText>
                    <AppText
                      accessibilityLiveRegion="polite"
                      style={{
                        color: ready ? "#FFFFFF" : "#B7C4BA",
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                      numberOfLines={2}
                    >
                      {ready
                        ? routeMetrics(option.route)
                        : state.status === "loading"
                          ? "Calculando ruta y desnivel\u2026"
                          : duplicate
                            ? `Mismo trazado que ${routePresentation[option.modes[0]].name}`
                            : state.status === "error"
                              ? "No se pudo calcular"
                              : "No disponible"}
                    </AppText>
                    {ready && (
                      <AppText
                        numberOfLines={1}
                        style={{
                          color: "#B7C4BA",
                          fontSize: 10,
                          lineHeight: 14,
                        }}
                      >
                        {meta.description}
                      </AppText>
                    )}
                  </View>
                  {state.status === "loading" ? (
                    <BrandLoader size="small" variant="dark" />
                  ) : (
                    <Ionicons
                      name={
                        active
                          ? "checkmark-circle"
                          : ready
                            ? "ellipse-outline"
                            : "information-circle-outline"
                      }
                      size={19}
                      color={active ? meta.color : "#8E9B92"}
                    />
                  )}
                </>
              );
              const card = {
                flexDirection: "row" as const,
                alignItems: "center" as const,
                gap: 10,
                borderRadius: 14,
                padding: 10,
                borderWidth: 2,
                borderColor: active ? meta.color : "#344138",
                backgroundColor: active ? "#213027" : "#17201A",
              };
              return (
                <View key={mode} style={card}>
                  {ready ? (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: !!active }}
                      accessibilityLabel={`${meta.name}, ${routeMetrics(option.route)}`}
                      onPress={() => onSelect(mode)}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {content}
                    </Pressable>
                  ) : (
                    <View
                      accessibilityLabel={`${meta.name}. ${state.status === "loading" ? "Calculando" : reason || "No disponible"}`}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {content}
                    </View>
                  )}
                  {(reason || ready) && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver detalles de ${meta.name}`}
                      onPress={() =>
                        Alert.alert(
                          meta.name,
                          reason ||
                            [
                              meta.description,
                              option
                                ? `D+ ${elevationLabel(option.route)} · D− ${elevationLabel(option.route, true)}`
                                : "",
                              option?.route.elevationError ||
                                "El desnivel procede de un modelo de terreno filtrado; no de una medición GPS.",
                              option?.route.coverage?.percent == null
                                ? "Porcentaje de ciclov\u00edas no disponible: falta correspondencia verificable con OSM."
                                : "Porcentaje de infraestructura registrada en OSM; no certifica seguridad ni estado f\u00edsico.",
                              option?.route.durationSource === "cycling_model"
                                ? "Tiempo estimado con modelo ciclista; no incluye tr\u00e1fico, sem\u00e1foros ni pendiente."
                                : "El tiempo es una estimaci\u00f3n del proveedor.",
                            ].join("\n\n"),
                        )
                      }
                      style={{
                        minHeight: 48,
                        minWidth: 28,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={18}
                        color="#B7C4BA"
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}
            {alternatives?.messages?.some((message) =>
              message.includes("coinciden"),
            ) && (
              <AppText style={{ fontSize: 11, color: "#B7C4BA" }}>
                Algunas modalidades coinciden; no hay tres trazados distintos.
              </AppText>
            )}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedReady || !onStart}
              onPress={onStart}
              style={{
                minHeight: 48,
                borderRadius: 24,
                backgroundColor: selectedReady ? "#A7F55B" : "#344138",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText
                weight="bold"
                style={{ color: selectedReady ? "#101713" : "#B7C4BA" }}
              >
                Iniciar ruta
              </AppText>
            </Pressable>
            {loading && (
              <AppText
                style={{
                  fontSize: 10,
                  color: "#B7C4BA",
                  textAlign: "center",
                  marginTop: 7,
                }}
              >
                Puedes usar la ruta disponible mientras terminan las otras
                opciones.
              </AppText>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
