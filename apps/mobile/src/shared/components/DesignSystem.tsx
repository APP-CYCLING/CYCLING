import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColors, useThemedStyles } from "../theme/ThemeContext";
import type { Palette } from "../theme/colors";
import { AppText } from "./AppText";
import { BrandLogo } from "./BrandLogo";
export { AppText } from "./AppText";
import { useAuth } from "../../modules/auth/context/AuthContext";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function IconButton({
  icon,
  label,
  onPress,
  active = false,
  dark = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  dark?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        active && { backgroundColor: colors.green },
        dark && { backgroundColor: colors.black },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={dark ? colors.green : active ? colors.black : colors.text}
      />
    </Pressable>
  );
}
export function Avatar({
  name,
  large = false,
}: {
  name?: string;
  large?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.avatar,
        large && { width: 80, height: 80, borderRadius: 40 },
      ]}
    >
      {name ? (
        <AppText weight="heavy" style={{ fontSize: large ? 28 : 14 }}>
          {name
            ?.trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "CY"}
        </AppText>
      ) : (
        <BrandLogo variant="emblem" width={large ? 56 : 28} />
      )}
    </View>
  );
}
export function ScreenHeader({
  title,
  back,
}: {
  title: string;
  back?: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  const { user } = useAuth();
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton icon="arrow-back" label="Volver" onPress={back} />
      ) : (
        <View style={styles.brand}>
          <BrandLogo width={100} />
        </View>
      )}
      <AppText
        weight="bold"
        numberOfLines={2}
        adjustsFontSizeToFit
        style={styles.headerTitle}
      >
        {title}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir mi perfil"
        onPress={() => router.push("/profile")}
        style={{ padding: 4 }}
      >
        <Avatar name={user?.name} />
      </Pressable>
    </View>
  );
}
export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={15}
          color={active ? colors.greenDark : colors.muted}
        />
      )}
      <AppText
        weight="medium"
        style={{
          fontSize: 12,
          color: active ? colors.greenDark : colors.muted,
        }}
      >
        {label}
      </AppText>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.softGreen }]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={[styles.chip, active && { backgroundColor: colors.softGreen }]}
    >
      {content}
    </View>
  );
}
export function MetricTile({
  value,
  label,
  icon,
  dark = false,
}: {
  value: string;
  label: string;
  icon?: IconName;
  dark?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.metric, dark && { backgroundColor: "#262D26" }]}>
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={dark ? colors.green : colors.greenDark}
        />
      )}
      <AppText
        weight="heavy"
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{
          fontSize: 23,
          fontVariant: ["tabular-nums"],
          color: dark ? colors.white : colors.text,
        }}
      >
        {value}
      </AppText>
      <AppText
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          color: dark ? "#C3CDC0" : colors.muted,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}
export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <AppText weight="bold" style={{ fontSize: 19, flex: 1 }}>
        {title}
      </AppText>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <AppText
            weight="bold"
            style={{ color: colors.greenDark, fontSize: 12 }}
          >
            {action} →
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      minHeight: 66,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.background,
    },
    brand: { alignItems: "center", gap: 1 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: 16 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.softGreen,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.white,
    },
    icon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 13,
      minHeight: 38,
      borderRadius: 24,
      backgroundColor: colors.surface,
    },
    metric: {
      flex: 1,
      minWidth: 0,
      borderRadius: 20,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 9,
    },
    section: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 26,
      marginBottom: 12,
      minHeight: 32,
    },
  });
