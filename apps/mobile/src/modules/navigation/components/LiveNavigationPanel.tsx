import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { useLiveNavigation } from "../hooks/useLiveNavigation";
import { distanceLabel } from "../utils/live-navigation";
import { AppText } from "../../../shared/components/DesignSystem";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
type Props = {
  navigation: ReturnType<typeof useLiveNavigation>;
  recording: boolean;
};
export function LiveNavigationPanel({ navigation: n, recording }: Props) {
  const colors = useThemeColors();

  const next = n.progress?.nextStep;
  const icon = /Left/.test(next?.maneuver ?? "")
    ? "arrow-back"
    : /Right/.test(next?.maneuver ?? "")
      ? "arrow-forward"
      : /Roundabout/.test(next?.maneuver ?? "")
        ? "sync-outline"
        : "arrow-up";
  const title = !recording
    ? "Recorrido detenido"
    : !n.precise
      ? "Esperando GPS preciso"
      : n.arrived
        ? "Llegaste a tu destino"
        : n.offRoute
          ? "Te alejaste de la ruta"
          : !n.route
            ? "Salida libre · GPS en vivo"
            : !n.ready
              ? "Comprobando tu posición en la ruta…"
              : next
                ? `En ${distanceLabel(n.progress!.toManeuver)}`
                : "Continúa hacia tu destino";
  const instruction = !recording
    ? "Puedes guardar la salida o iniciar un nuevo recorrido."
    : !n.precise
      ? "Las indicaciones se reanudarán con una ubicación reciente y precisa."
      : n.arrived
        ? "Finaliza y guarda cuando estés listo."
        : n.offRoute
          ? "Recalcula desde tu ubicación actual para continuar."
          : !n.route
            ? "El mapa sigue tu movimiento. Sin destino no hay indicaciones de giro."
            : n.ready
              ? next?.instruction ||
                (n.route.steps?.length
                  ? "Sigue el trazado hasta el punto de llegada."
                  : "Esta ruta no incluye giros. Pulsa «Actualizar indicaciones» para obtenerlos.")
              : "Esperando confirmar el tramo antes de indicar un giro.";
  return (
    <View
      style={{
        backgroundColor: colors.black,
        padding: 14,
        borderRadius: 22,
        gap: 10,
        elevation: 5,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.green,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={n.arrived ? "flag" : n.offRoute ? "warning-outline" : icon}
            size={26}
            color={colors.black}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            weight="bold"
            numberOfLines={2}
            style={{ color: colors.green, fontSize: 15 }}
          >
            {title}
          </AppText>
          <AppText
            weight="bold"
            numberOfLines={3}
            style={{ color: colors.white, fontSize: 13, lineHeight: 19 }}
          >
            {instruction}
          </AppText>
        </View>
      </View>
      {!!n.streetName && n.precise && (
        <AppText
          numberOfLines={1}
          style={{ color: colors.white, fontSize: 12 }}
        >
          Cerca de: {n.streetName}
        </AppText>
      )}
      {!!n.lane && n.precise && (
        <AppText
          numberOfLines={2}
          style={{ color: colors.green, fontSize: 11 }}
        >
          Infraestructura cercana (OSM): {n.lane.name} ·{" "}
          {
            (
              {
                cycleway: "vía ciclista",
                track: "pista separada",
                lane: "carril ciclista",
                shared: "compartido",
                designated: "uso ciclista designado",
              } as Record<string, string>
            )[n.lane.kind]
          }
        </AppText>
      )}
    </View>
  );
}
