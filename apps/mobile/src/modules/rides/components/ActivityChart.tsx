import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Ride } from "@cycling/contracts";
import { dailyDistances } from "../utils/activity-summary";
import { AppText } from "../../../shared/components/DesignSystem";
import { Panel } from "../../../shared/components/UI";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
export function ActivityChart({ rides }: { rides: Ride[] }) {
  const colors = useThemeColors();

  const bars = dailyDistances(rides),
    max = Math.max(...bars.map((bar) => bar.distance)),
    peak = bars.find((bar) => bar.distance === max);
  return (
    <Panel style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="bar-chart-outline" size={19} color={colors.greenDark} />
        <AppText weight="bold" style={{ flex: 1 }}>
          Kilometraje por día
        </AppText>
        <AppText style={{ color: colors.muted, fontSize: 10 }}>
          Esta semana
        </AppText>
      </View>
      <AppText style={{ fontSize: 11, color: colors.greenDark }}>
        {max
          ? `Pico semanal: ${max.toFixed(1)} km (${peak?.label})`
          : "Tu próxima salida dará vida al gráfico."}
      </AppText>
      <View
        style={{
          flexDirection: "row",
          gap: 9,
          height: 136,
          alignItems: "flex-end",
        }}
      >
        {bars.map((bar) => (
          <View
            key={bar.label}
            accessible
            accessibilityLabel={`${bar.label}: ${bar.distance.toFixed(1)} kilómetros`}
            style={{ flex: 1, alignItems: "center", gap: 7 }}
          >
            <AppText
              style={{ fontSize: 9, color: colors.muted }}
              numberOfLines={1}
            >
              {bar.distance ? bar.distance.toFixed(1) : ""}
            </AppText>
            <View
              style={{
                height:
                  bar.distance && max
                    ? Math.max(8, (bar.distance / max) * 86)
                    : 3,
                width: "100%",
                maxWidth: 40,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                backgroundColor:
                  bar.distance === max && max > 0
                    ? colors.green
                    : colors.border,
              }}
            />
            <AppText style={{ fontSize: 10 }}>{bar.label}</AppText>
          </View>
        ))}
      </View>
    </Panel>
  );
}
