import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, type Palette } from "./colors";
type Theme = { scheme: "light" | "dark"; colors: Palette };
const Context = createContext<Theme>({ scheme: "dark", colors: darkColors });
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const scheme = system === "light" ? "light" : "dark";
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === "dark" ? darkColors : lightColors }),
    [scheme],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTheme() {
  return useContext(Context);
}
export const useThemeColors = () => useTheme().colors;
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
