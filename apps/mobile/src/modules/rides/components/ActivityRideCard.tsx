import { rideDisplayName } from "../utils/ride-name";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Ride } from "@cycling/contracts";
import { AppText } from "../../../shared/components/DesignSystem";
import { RecordedRideMap, rideStatusLabel } from "./RecordedRideMap";
import { durationLabel } from "../utils/activity-summary";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
export function RideMetrics({ ride }: { ride: Ride }) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  return (
    <View style={s.metrics}>
      {[
        [ride.distanceKm.toFixed(1), "km"],
        [durationLabel(ride.durationSec), "tiempo"],
        [
          (ride.durationSec
            ? (ride.distanceKm * 3600) / ride.durationSec
            : 0
          ).toFixed(1),
          "km/h · media",
        ],
        [String(ride.coordinates.length), "puntos GPS"],
      ].map(([value, label]) => (
        <View key={label} style={{ flex: 1, alignItems: "center", gap: 5 }}>
          <AppText
            weight="bold"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 18 }}
          >
            {value}
          </AppText>
          <AppText style={{ fontSize: 9, color: colors.muted }}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
export function ActivityRideCard({
  ride,
  showMap,
  onMap,
  onDetail,
  record,
}: {
  ride: Ride;
  showMap: boolean;
  onMap: () => void;
  onDetail: () => void;
  record?: boolean;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const hour = new Date(ride.startedAt).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={s.card}>
      {record && (
        <View style={s.record}>
          <Ionicons name="trophy-outline" size={14} color={colors.greenDark} />
          <AppText
            weight="bold"
            style={{ color: colors.greenDark, fontSize: 10 }}
          >
            Mayor distancia del historial
          </AppText>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 7 }}>
          <AppText weight="bold" style={s.tag}>
            {rideStatusLabel(ride)}
          </AppText>
          <AppText weight="bold" style={{ fontSize: 18 }}>
            {rideDisplayName(ride)}
          </AppText>
          <AppText style={{ fontSize: 11, color: colors.muted }}>
            ◷ {hour} · Bicicleta
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver detalle del recorrido"
          onPress={onDetail}
          style={s.options}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ borderRadius: 16, overflow: "hidden" }}>
        {showMap ? (
          <RecordedRideMap ride={ride} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onMap}
            style={s.mapButton}
          >
            <Ionicons name="map-outline" color={colors.greenDark} size={28} />
            <AppText
              weight="medium"
              style={{ fontSize: 12, color: colors.greenDark }}
            >
              {ride.coordinates.length >= 2
                ? "Ver mapa del recorrido"
                : "Consultar datos del recorrido"}
            </AppText>
          </Pressable>
        )}
      </View>
      <RideMetrics ride={ride} />
      <Pressable accessibilityRole="button" onPress={onDetail} style={s.detail}>
        <AppText weight="bold" style={{ fontSize: 12 }}>
          Ver detalle del recorrido
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 14,
    },
    tag: {
      fontSize: 9,
      letterSpacing: 0.7,
      color: colors.greenDark,
      backgroundColor: colors.softGreen,
      alignSelf: "flex-start",
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    options: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceLow,
      alignItems: "center",
      justifyContent: "center",
    },
    mapButton: {
      height: 108,
      backgroundColor: colors.surfaceLow,
      gap: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    metrics: {
      flexDirection: "row",
      gap: 5,
      backgroundColor: colors.surfaceLow,
      paddingVertical: 14,
      paddingHorizontal: 7,
      borderRadius: 16,
    },
    detail: {
      backgroundColor: colors.surfaceLow,
      borderRadius: 24,
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    record: {
      alignSelf: "flex-end",
      borderRadius: 14,
      backgroundColor: colors.softGreen,
      padding: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
  });
