import React from "react";
import { ImageBackground, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { CyclingRoute } from "@cycling/contracts";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
import { AppText, Chip } from "../../../shared/components/DesignSystem";
const covers = [
  require("../../../../assets/images/stitch/route-1.jpg"),
  require("../../../../assets/images/stitch/route-2.jpg"),
  require("../../../../assets/images/stitch/route-3.jpg"),
];
const diff = { easy: "Fácil", moderate: "Intermedia", hard: "Exigente" };
export function RouteCard({
  route,
  coverIndex,
}: {
  route: CyclingRoute;
  coverIndex?: number;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ruta ${route.title}`}
      onPress={() =>
        router.push({ pathname: "/route/[id]", params: { id: route.id } })
      }
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 24,
        overflow: "hidden",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {coverIndex !== undefined && (
        <ImageBackground
          source={covers[coverIndex % covers.length]}
          style={{
            height: 140,
            padding: 12,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
          accessibilityLabel="Imagen ilustrativa de ciclismo"
        >
          <Chip label={diff[route.difficulty]} active />
          <View
            style={{
              backgroundColor: "#151915B8",
              borderRadius: 8,
              padding: 5,
            }}
          >
            <AppText style={{ fontSize: 9, color: colors.white }}>
              IMAGEN ILUSTRATIVA
            </AppText>
          </View>
        </ImageBackground>
      )}
      <View style={{ padding: 18, gap: 10 }}>
        <AppText weight="bold" style={{ fontSize: 18 }}>
          {route.title}
        </AppText>
        <AppText
          style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
          numberOfLines={2}
        >
          {route.description}
        </AppText>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Ionicons name="bicycle-outline" size={18} color={colors.greenDark} />
          <AppText weight="bold" style={{ fontSize: 12 }}>
            {route.distanceKm} km
          </AppText>
          <AppText style={{ color: colors.muted, fontSize: 12 }}>
            {route.durationMin} min · ↗ {route.ascentM} m
          </AppText>
        </View>
        {coverIndex === undefined && (
          <Chip label={diff[route.difficulty]} active />
        )}
        {route.isDemo && (
          <AppText style={{ color: colors.warning, fontSize: 11 }}>
            Trazado de demostración, no verificado
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
