export const lightColors = {
  green: "#A7F55B",
  greenDark: "#3A6A00",
  black: "#0F1210",
  white: "#FFFFFF",
  background: "#F6F8F3",
  muted: "#697268",
  border: "#E3EAE2",
  danger: "#B94036",
  surface: "#FFFFFF",
  softGreen: "#EAF7DC",
  surfaceLow: "#EFF5ED",
  warning: "#9B681D",
  text: "#0F1210",
  dangerSurface: "#FFEBE8",
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  ...lightColors,
  background: "#0F1210",
  surface: "#1A221C",
  surfaceLow: "#202B22",
  text: "#F3F8F0",
  muted: "#B4C1B0",
  border: "#354336",
  greenDark: "#A7F55B",
  softGreen: "#25371E",
  danger: "#FFAAA0",
  dangerSurface: "#422822",
  warning: "#E8BE72",
};
// Fixed palette for external map rendering; themed UI uses useThemeColors.
export const colors = lightColors;
