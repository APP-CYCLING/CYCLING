import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../shared/components/DesignSystem";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
import { BrandLogo } from "../../../shared/components/BrandLogo";
export function AuthHeader({
  onBack,
  busy,
}: {
  onBack: () => void;
  busy: boolean;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onBack}
        style={s.back}
      >
        <Ionicons name="arrow-back" color={colors.text} size={25} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <BrandLogo width={145} />
      </View>
      <View
        accessible
        accessibilityLabel="Cuenta CYCLING"
        style={s.accountIcon}
      >
        <Ionicons name="person-outline" color={colors.background} size={18} />
      </View>
    </View>
  );
}
export function RememberEmail({
  checked,
  disabled,
  onPress,
}: {
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Recordar mi correo en este equipo"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.remember, disabled && { opacity: 0.6 }]}
    >
      <View style={s.phone}>
        <Ionicons
          name="phone-portrait-outline"
          color={colors.muted}
          size={18}
        />
      </View>
      <AppText weight="medium" style={{ flex: 1, fontSize: 12 }}>
        Recordar mi correo en este equipo
      </AppText>
      <View
        style={[
          s.track,
          { backgroundColor: checked ? "#2B322D" : colors.border },
        ]}
      >
        <View
          style={[s.thumb, { transform: [{ translateX: checked ? 20 : 0 }] }]}
        >
          {checked && <View style={s.dot} />}
        </View>
      </View>
    </Pressable>
  );
}
export function SocialOptions({ register }: { register: boolean }) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const social = register
    ? ["Strava", "Google", "Apple"]
    : ["Strava", "Apple", "Google"];
  return (
    <View style={{ gap: 15 }}>
      <View style={s.divider}>
        <View style={s.line} />
        <AppText
          weight="bold"
          style={{ fontSize: 10, letterSpacing: 0.8, color: colors.muted }}
        >
          {register ? "O REGÍSTRATE CON" : "O CONTINÚA CON"}
        </AppText>
        <View style={s.line} />
      </View>
      <View style={{ flexDirection: "row", gap: 9 }}>
        {social.map((provider) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`${provider}: próximamente`}
            accessibilityState={{ disabled: true }}
            disabled
            style={s.socialButton}
          >
            {provider === "Strava" ? (
              <FontAwesome5 name="strava" size={21} color="#FC4C02" />
            ) : (
              <Ionicons
                name={provider === "Apple" ? "logo-apple" : "logo-google"}
                size={21}
                color={provider === "Apple" ? colors.text : "#4285F4"}
              />
            )}
            {register && (
              <AppText weight="medium" style={{ fontSize: 12 }}>
                {provider}
              </AppText>
            )}
          </Pressable>
        ))}
      </View>
      <AppText
        style={{ textAlign: "center", color: colors.muted, fontSize: 11 }}
      >
        Acceso social: próximamente.
      </AppText>
    </View>
  );
}
export function LegalNotice() {
  const colors = useThemeColors();

  return (
    <View style={{ paddingHorizontal: 8, gap: 5 }}>
      <AppText
        style={{
          color: colors.muted,
          fontSize: 11,
          lineHeight: 18,
          textAlign: "center",
        }}
      >
        Términos de Servicio y Política de Privacidad de CYCLING: pendientes de
        publicación.
      </AppText>
    </View>
  );
}
export function AuthFeedback({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        padding: 15,
        gap: 9,
        borderRadius: 16,
        backgroundColor: error ? colors.dangerSurface : colors.softGreen,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <Ionicons
        name={error ? "alert-circle-outline" : "information-circle-outline"}
        size={20}
        color={error ? colors.danger : colors.greenDark}
      />
      <AppText
        accessibilityRole="alert"
        style={{
          flex: 1,
          color: error ? colors.danger : colors.greenDark,
          fontSize: 12,
          lineHeight: 19,
        }}
      >
        {message}
      </AppText>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      width: "100%",
      maxWidth: 512,
      alignSelf: "center",
      minHeight: 64,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    back: {
      minWidth: 44,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -7,
    },
    brandIcon: {
      width: 30,
      height: 30,
      backgroundColor: colors.green,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    accountIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.greenDark,
      alignItems: "center",
      justifyContent: "center",
    },
    remember: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 48,
    },
    phone: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      alignItems: "center",
      justifyContent: "center",
    },
    track: { width: 48, height: 28, padding: 2, borderRadius: 14 },
    thumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.green,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 6,
    },
    line: { flex: 1, height: 1, backgroundColor: colors.border },
    socialButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      flexDirection: "row",
      opacity: 0.7,
    },
  });
