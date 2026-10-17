import React from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import type { CyclingMapProps } from "../types/map.types";
import { useThemeColors } from "../../../shared/theme/ThemeContext";

export function CyclingMap(props: CyclingMapProps) {
  const colors = useThemeColors();

  const missingKey = !process.env.EXPO_PUBLIC_MAPTILER_KEY;
  const expoGo = Constants.executionEnvironment === "storeClient";
  if (expoGo || missingKey)
    return (
      <View
        style={{
          flex: props.fill ? 1 : undefined,
          height: props.fill ? undefined : (props.height ?? 330),
          backgroundColor: colors.softGreen,
          padding: 24,
          justifyContent: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
          {expoGo
            ? "Abre cycling en su compilación propia"
            : "Mapa sin configurar"}
        </Text>
        <Text style={{ color: colors.greenDark, lineHeight: 22 }}>
          {expoGo
            ? "Este mapa necesita la versión de desarrollo de cycling instalada en tu teléfono. Expo Go no incluye el motor cartográfico."
            : "Falta la configuración pública de MapTiler. Reinicia la app después de configurarla."}
        </Text>
      </View>
    );
  // No importar el módulo nativo en Expo Go: evita una excepción antes de mostrar el aviso.
  const { NativeCyclingMap } =
    require("./NativeCyclingMap") as typeof import("./NativeCyclingMap");
  return <NativeCyclingMap {...props} />;
}
