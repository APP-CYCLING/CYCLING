import React, { useState } from "react";
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
export function AuthInput({
  label,
  icon,
  error,
  password = false,
  inputRef,
  labelAction,
  ...props
}: TextInputProps & {
  label: string;
  icon: IconName;
  error?: string;
  password?: boolean;
  inputRef?: React.Ref<TextInput>;
  labelAction?: React.ReactNode;
}) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const [visible, setVisible] = useState(false),
    [focused, setFocused] = useState(false);
  const fontFamily = useFontFamily();
  return (
    <View style={{ gap: 8 }}>
      <View style={s.labelRow}>
        <AppText weight="medium" style={{ fontSize: 13 }}>
          {label}
        </AppText>
        {labelAction}
      </View>
      <View
        style={[
          s.field,
          focused && { borderColor: colors.greenDark },
          !!error && { borderColor: colors.danger },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.muted} />
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          secureTextEntry={password && !visible}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[s.input, { fontFamily }]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            style={s.eye}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={21}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
      {!!error && (
        <AppText
          accessibilityRole="alert"
          style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}
        >
          {error}
        </AppText>
      )}
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "transparent",
      minHeight: 54,
      paddingLeft: 16,
      paddingRight: 5,
      gap: 11,
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      fontSize: 14,
      color: colors.text,
      fontFamily: fonts.regular,
      paddingVertical: 12,
      paddingRight: 8,
    },
    eye: {
      minWidth: 44,
      minHeight: 48,
      justifyContent: "center",
      alignItems: "center",
    },
  });
