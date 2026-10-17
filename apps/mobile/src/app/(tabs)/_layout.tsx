import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useThemeColors } from "../../shared/theme/ThemeContext";
import { useFontFamily } from "../../shared/theme/FontContext";
export default function TabsLayout() {
  const colors = useThemeColors();

  const insets = useSafeAreaInsets();
  const fontFamily = useFontFamily("bold");
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.greenDark,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            height: 72 + Math.max(insets.bottom, 8),
            paddingTop: 9,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily,
            fontWeight: fontFamily ? undefined : "700",
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Inicio",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Explorar",
            tabBarIcon: ({ color }) => (
              <Ionicons name="map-outline" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="ride"
          options={{
            title: "Pedalear",
            tabBarIcon: () => (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.green,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -12,
                }}
              >
                <Ionicons name="bicycle" color={colors.black} size={27} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Actividad",
            tabBarIcon: ({ color }) => (
              <Ionicons name="stats-chart-outline" color={color} size={23} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" color={color} size={23} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
