import React, { useContext } from "react";
import { StyleSheet, Text, TextProps } from "react-native";
import { useThemeColors } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { FontReadyContext } from "../theme/FontContext";
import { appTextTypography } from "../theme/font-fallback";
export function AppText({
  style,
  weight = "regular",
  ...props
}: TextProps & { weight?: keyof typeof fonts }) {
  const colors = useThemeColors();

  const ready = useContext(FontReadyContext);
  return (
    <Text
      {...props}
      style={[
        { color: colors.text, fontSize: 14 },
        appTextTypography(ready, weight, StyleSheet.flatten(style)),
      ]}
    />
  );
}
