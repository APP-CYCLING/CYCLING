import React from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  type IconName,
} from "../../../shared/components/DesignSystem";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
import { fonts } from "../../../shared/theme/typography";
import { useFontFamily } from "../../../shared/theme/FontContext";
export function ProfileSectionTitle({
  title,
  icon,
  hint,
}: {
  title: string;
  icon: IconName;
  hint?: string;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  return (
    <View style={s.title}>
      <Ionicons name={icon} size={19} color={colors.greenDark} />
      <AppText weight="bold" style={{ fontSize: 19, flex: 1 }}>
        {title}
      </AppText>
      {hint && (
        <AppText style={{ fontSize: 11, color: colors.muted }}>{hint}</AppText>
      )}
    </View>
  );
}
export function ProfileField({
  label,
  suffix,
  style,
  ...props
}: TextInputProps & { label: string; suffix?: string }) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const fontFamily = useFontFamily();
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <AppText style={{ fontSize: 12 }}>{label}</AppText>
      <View style={[s.field, props.multiline && { alignItems: "flex-start" }]}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          style={[
            s.input,
            props.multiline && { minHeight: 90, textAlignVertical: "top" },
            style,
            { fontFamily },
          ]}
        />
        {suffix && (
          <AppText style={{ fontSize: 12, color: colors.muted }}>
            {suffix}
          </AppText>
        )}
      </View>
    </View>
  );
}
export function SettingsRow({
  title,
  detail,
  icon,
  onPress,
  pending = false,
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress?: () => void;
  pending?: boolean;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const content = (
    <>
      <View style={s.rowIcon}>
        <Ionicons name={icon} color={colors.greenDark} size={20} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText weight="medium">{title}</AppText>
        <AppText style={{ fontSize: 11, lineHeight: 16, color: colors.muted }}>
          {detail}
        </AppText>
      </View>
      <Ionicons
        name={pending ? "time-outline" : "chevron-forward"}
        size={18}
        color={colors.muted}
      />
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.row}>
      {content}
    </Pressable>
  ) : (
    <View style={s.row}>{content}</View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    title: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 22,
      marginBottom: 8,
    },
    field: {
      backgroundColor: colors.surfaceLow,
      paddingHorizontal: 13,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      fontFamily: fonts.regular,
      color: colors.text,
      flex: 1,
      minHeight: 48,
      fontSize: 14,
      paddingVertical: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 76,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowIcon: {
      backgroundColor: colors.surfaceLow,
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
  });
