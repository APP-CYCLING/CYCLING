import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import { BrandLogo } from "./BrandLogo";
import { brandMotion } from "./brand-motion";
export const brandLoaderSizes = { small: 48, medium: 112, large: 192 };
function MotionFrame({
  source,
  index,
  count,
  progress,
}: {
  source: ImageSourcePropType;
  index: number;
  count: number;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.floor(progress.value) % count === index ? 1 : 0,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", inset: 0 }, style]}
    >
      <Image
        source={source}
        accessible={false}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </Animated.View>
  );
}
export function BrandLoader({
  size = "medium",
  variant = "auto",
  message,
  fullScreen = false,
  style,
}: {
  size?: keyof typeof brandLoaderSizes;
  variant?: "auto" | "light" | "dark";
  message?: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme(),
    scheme = variant === "auto" ? theme.scheme : variant;
  const systemReduced = useReducedMotion();
  const [reduced, setReduced] = useState(systemReduced),
    [foreground, setForeground] = useState(
      AppState.currentState !== "background",
    );
  const progress = useSharedValue(0),
    animation = brandMotion[scheme],
    dimension = brandLoaderSizes[size];
  useEffect(() => {
    let current = true,
      preferenceChanged = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current && !preferenceChanged) setReduced(value);
      })
      .catch(() => {});
    const preference = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        preferenceChanged = true;
        setReduced(value);
      },
    );
    const state = AppState.addEventListener("change", (value) =>
      setForeground(value !== "background"),
    );
    return () => {
      current = false;
      preference.remove();
      state.remove();
    };
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!reduced && foreground)
      progress.value = withRepeat(
        withTiming(animation.frames.length - 0.001, {
          duration: animation.duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        false,
      );
    return () => cancelAnimation(progress);
  }, [animation, reduced, foreground, progress]);
  const dark = scheme === "dark";
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message || "Cargando"}
      accessibilityState={{ busy: true }}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingVertical: size === "small" ? 0 : 16,
        },
        fullScreen && {
          flex: 1,
          backgroundColor: dark ? "#0F1210" : "#F6F8F3",
        },
        style,
      ]}
    >
      <View
        style={{
          width: dimension,
          height: dimension,
          borderRadius: dimension / 5,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {reduced || !foreground ? (
          <BrandLogo variant="emblem" theme={scheme} width={dimension * 0.8} />
        ) : (
          animation.frames.map((source, index) => (
            <MotionFrame
              key={index}
              source={source}
              index={index}
              count={animation.frames.length}
              progress={progress}
            />
          ))
        )}
      </View>
      {!!message && (
        <Text
          style={{
            color: dark ? "#FFFFFF" : "#0F1210",
            textAlign: "center",
            maxWidth: 340,
            paddingHorizontal: 16,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
