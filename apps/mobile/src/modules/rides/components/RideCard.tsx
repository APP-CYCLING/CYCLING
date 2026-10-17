import { rideDisplayName } from "../utils/ride-name";
import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Ride } from "@cycling/contracts";
import { AppText } from "../../../shared/components/DesignSystem";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
export function RideCard({ ride }: { ride: Ride }) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const average =
    ride.durationSec > 0 ? ride.distanceKm / (ride.durationSec / 3600) : 0;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.icon}>
          <Ionicons name="bicycle" size={24} color={colors.greenDark} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <AppText weight="bold" style={{ fontSize: 16 }}>
            {rideDisplayName(ride)}
          </AppText>
          <AppText style={{ color: colors.muted, fontSize: 12 }}>
            {new Date(ride.startedAt).toLocaleDateString("es", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </AppText>
        </View>
        <Ionicons name="checkmark-circle" size={19} color={colors.greenDark} />
      </View>
      <View
        style={[
          s.row,
          { paddingTop: 15, borderTopWidth: 1, borderColor: colors.border },
        ]}
      >
        {[
          [ride.distanceKm.toFixed(1), "KM"],
          [Math.round(ride.durationSec / 60).toString(), "MIN"],
          [average.toFixed(1), "KM/H · MEDIA"],
        ].map(([value, label]) => (
          <View key={label} style={{ flex: 1, gap: 5 }}>
            <AppText weight="heavy" style={{ fontSize: 21 }}>
              {value}
            </AppText>
            <AppText
              style={{ fontSize: 9, color: colors.muted, letterSpacing: 0.5 }}
            >
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 18,
      gap: 16,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.softGreen,
    },
  });
