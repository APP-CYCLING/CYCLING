import React from "react";
import { Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./DesignSystem";
import { useTheme } from "../theme/ThemeContext";

export function ThemeSettingsRow() {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: 12,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 52,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceLow,
          }}
        >
          <Ionicons name="moon-outline" size={20} color={colors.greenDark} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight="medium">Modo oscuro</AppText>
          <AppText
            style={{ fontSize: 11, lineHeight: 16, color: colors.muted }}
          >
            {theme.saving
              ? "Guardando preferencia…"
              : theme.scheme === "dark"
                ? "Activado. Se usa el tema oscuro en esta aplicación."
                : "Desactivado. Se usa el tema claro en esta aplicación."}
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Modo oscuro"
          accessibilityHint="Activa el tema oscuro de CYCLING. Al desactivarlo se usa el tema claro."
          value={theme.scheme === "dark"}
          disabled={!theme.ready || theme.saving}
          onValueChange={(enabled) => void theme.setDarkMode(enabled)}
          trackColor={{ false: colors.border, true: colors.greenDark }}
          thumbColor={theme.scheme === "dark" ? colors.green : colors.white}
          ios_backgroundColor={colors.border}
        />
      </View>
      {!!theme.error && (
        <AppText
          accessibilityRole="alert"
          style={{ fontSize: 12, color: colors.danger }}
        >
          {theme.error}
        </AppText>
      )}
    </View>
  );
}
