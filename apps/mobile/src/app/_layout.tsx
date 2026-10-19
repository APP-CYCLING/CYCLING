import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../modules/auth/context/AuthContext";
import { getConfigurationError } from "../shared/config/env";
import { StartupScreen } from "../shared/components/StartupScreen";
import { FontReadyContext } from "../shared/theme/FontContext";
import { ThemeProvider, useTheme } from "../shared/theme/ThemeContext";
import * as SystemUI from "expo-system-ui";
import { RecordingLifecycle } from "../modules/rides/components/RecordingLifecycle";
export default function Root() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
export function RootContent() {
  const { colors, scheme } = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("../../assets/fonts/Inter_400Regular.ttf"),
    Inter_600SemiBold: require("../../assets/fonts/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("../../assets/fonts/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("../../assets/fonts/Inter_800ExtraBold.ttf"),
  });
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontWaitExpired(true), 3000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  const error = getConfigurationError();
  if (error)
    return <StartupScreen title="Configuración pendiente" message={error} />;
  if (!fontsLoaded && !fontError && !fontWaitExpired)
    return <StartupScreen loading message="Preparando la interfaz…" />;
  return (
    <FontReadyContext.Provider value={fontsLoaded}>
      <AuthProvider>
        <RecordingLifecycle />
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "800" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="route/[id]"
            options={{ title: "Detalle de ruta" }}
          />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="albums" options={{ headerShown: false }} />
          <Stack.Screen
            name="edit-profile"
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack>
      </AuthProvider>
    </FontReadyContext.Provider>
  );
}
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <StartupScreen
        title="No se pudo abrir CYCLING"
        message={
          error.message || "No se pudo cargar la pantalla. Intenta de nuevo."
        }
        onRetry={() => void retry()}
      />
    </ThemeProvider>
  );
}
