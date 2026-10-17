import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SplashScreen } from "expo-router";
import { useTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Palette } from "../theme/colors";
import { BrandLogo } from "./BrandLogo";
import { BrandLoader } from "./BrandLoader";
import { StatusBar } from "expo-status-bar";

/** Arranque independiente de fuentes, iconos, sesión y red. */
export function StartupScreen({
  title = "Abriendo CYCLING",
  message,
  loading = false,
  onRetry,
}: {
  title?: string;
  message: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const { scheme, colors } = useTheme();
  const s = useThemedStyles(createStyles);
  return (
    <SafeAreaView
      style={s.screen}
      onLayout={() => {
        void SplashScreen.hideAsync().catch(() => {});
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <BrandLogo width={240} />
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {loading && <BrandLoader size="large" />}
        <Text
          accessibilityRole={loading ? undefined : "alert"}
          style={s.message}
        >
          {message}
        </Text>
        {onRetry && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={s.button}
          >
            <Text style={s.buttonText}>Reintentar</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      gap: 20,
    },
    title: {
      fontSize: 23,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    message: {
      maxWidth: 420,
      color: colors.muted,
      textAlign: "center",
      fontSize: 14,
      lineHeight: 22,
    },
    button: {
      minHeight: 52,
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 28,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: { color: colors.black, fontSize: 15, fontWeight: "700" },
  });
