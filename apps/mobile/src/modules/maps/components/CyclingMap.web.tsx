import React from "react";
import { Text, View } from "react-native";
import type { CyclingMapProps } from "../types/map.types";
import { useThemeColors } from "../../../shared/theme/ThemeContext";

export function CyclingMap({ height = 330, fill }: CyclingMapProps) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        height: fill ? undefined : height,
        flex: fill ? 1 : undefined,
        borderRadius: 22,
        backgroundColor: colors.softGreen,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
        Mapa disponible en la app móvil
      </Text>
      <Text
        style={{ color: colors.greenDark, textAlign: "center", lineHeight: 21 }}
      >
        Abre la app en Android o iOS para ver el mapa de rutas, ciclovías y tu
        recorrido.
      </Text>
    </View>
  );
}
