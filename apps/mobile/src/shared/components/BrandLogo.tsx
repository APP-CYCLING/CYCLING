import React from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
export const brandAssets = {
  horizontal: require("../../../assets/branding/01_LOGO/logo-horizontal-transparente.png"),
  horizontalDark: require("../../../assets/branding/01_LOGO/logo-horizontal-monocromatico-negro.png"),
  horizontalWhite: require("../../../assets/branding/01_LOGO/logo-horizontal-monocromatico-blanco.png"),
  emblem: require("../../../assets/branding/01_LOGO/logo-emblema-transparente.png"),
  emblemDark: require("../../../assets/branding/01_LOGO/logo-emblema-monocromatico-negro.png"),
  emblemWhite: require("../../../assets/branding/01_LOGO/logo-emblema-monocromatico-blanco.png"),
};
export function BrandLogo({
  variant = "horizontal",
  theme,
  width,
  monochrome = false,
  style,
}: {
  variant?: "horizontal" | "emblem";
  theme?: "light" | "dark";
  width?: number;
  monochrome?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const current = useTheme(),
    dark = (theme ?? current.scheme) === "dark";
  const size = width ?? (variant === "horizontal" ? 170 : 40);
  const source =
    variant === "horizontal"
      ? dark
        ? monochrome
          ? brandAssets.horizontalWhite
          : brandAssets.horizontal
        : brandAssets.horizontalDark
      : monochrome
        ? dark
          ? brandAssets.emblemWhite
          : brandAssets.emblemDark
        : brandAssets.emblem;
  return (
    <View
      accessibilityLabel="CYCLING"
      accessibilityRole="image"
      accessible
      style={[
        style,
        {
          width: size,
          maxWidth: "100%",
          aspectRatio: variant === "horizontal" ? 3 : 1,
        },
      ]}
    >
      <Image
        source={source}
        accessible={false}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
      {!dark && !monochrome && variant === "horizontal" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "30.5%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* The official variants have identical alpha masks. The clip ends in their transparent gap. */}
          <Image
            source={brandAssets.horizontal}
            accessible={false}
            resizeMode="contain"
            style={{ width: "327.868852459%", height: "100%" }}
          />
        </View>
      )}
    </View>
  );
}
