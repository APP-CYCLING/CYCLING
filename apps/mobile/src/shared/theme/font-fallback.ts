import type { TextStyle } from "react-native";
import { fonts } from "./typography";
export function appTextTypography(
  ready: boolean,
  weight: keyof typeof fonts,
  style: TextStyle = {},
): TextStyle {
  const requested = style.fontFamily ?? fonts[weight];
  if (ready || !Object.values(fonts).includes(requested))
    return { ...style, fontFamily: requested };
  const weights: Record<string, TextStyle["fontWeight"]> = {
    [fonts.regular]: "400",
    [fonts.medium]: "600",
    [fonts.bold]: "700",
    [fonts.heavy]: "800",
  };
  return {
    ...style,
    fontFamily: undefined,
    fontWeight: style.fontWeight ?? weights[requested],
  };
}
