import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { AppText as Text } from "./AppText";
import { BrandLoader } from "./BrandLoader";
import { fonts } from "../theme/typography";
import { useFontFamily } from "../theme/FontContext";
import { useThemeColors, useThemedStyles } from "../theme/ThemeContext";
import type { Palette } from "../theme/colors";
export function Page({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const s = useThemedStyles(createStyles);

  return scroll ? (
    <ScrollView
      removeClippedSubviews={false}
      style={s.page}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.page, s.content, { flex: 1 }]}>{children}</View>
  );
}
export function H1({ children }: { children: ReactNode }) {
  const s = useThemedStyles(createStyles);

  return <Text style={s.h1}>{children}</Text>;
}
export function Subtitle({ children }: { children: ReactNode }) {
  const s = useThemedStyles(createStyles);

  return <Text style={s.subtitle}>{children}</Text>;
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const s = useThemedStyles(createStyles);

  return (
    <View style={{ marginTop: 24, gap: 12 }}>
      <Text style={s.section}>{title}</Text>
      {children}
    </View>
  );
}
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const s = useThemedStyles(createStyles);

  return <View style={[s.panel, style]}>{children}</View>;
}
export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  outline = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  outline?: boolean;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        s.button,
        outline && {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.heavy,
          fontSize: 15,
          color: outline ? colors.text : colors.black,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const fontFamily = useFontFamily();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.text }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.field, style, { fontFamily }]}
      />
    </View>
  );
}
export function Busy() {
  return <BrandLoader message="Cargando…" />;
}
export function Notice({ message }: { message: string }) {
  const colors = useThemeColors();

  return (
    <Panel style={{ backgroundColor: colors.softGreen }}>
      <Text style={{ color: colors.greenDark, lineHeight: 20 }}>{message}</Text>
    </Panel>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 20,
      paddingBottom: 32,
      gap: 8,
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
    },
    h1: {
      fontSize: 32,
      fontFamily: fonts.heavy,
      letterSpacing: -1,
      color: colors.text,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
    },
    section: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text },
    panel: {
      padding: 17,
      backgroundColor: colors.surface,
      borderRadius: 24,
      gap: 9,
    },
    button: {
      minHeight: 56,
      borderRadius: 30,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    field: {
      fontFamily: fonts.regular,
      backgroundColor: colors.surface,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 15,
      minHeight: 50,
      color: colors.text,
    },
  });
