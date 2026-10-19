import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type Palette } from "./colors";
import { ThemePreference } from "./theme-preference";

const preference = new ThemePreference(AsyncStorage);
type Theme = {
  scheme: "light" | "dark";
  colors: Palette;
  ready: boolean;
  saving: boolean;
  error: string;
  setDarkMode: (enabled: boolean) => Promise<void>;
};
const Context = createContext<Theme>({
  scheme: "light",
  colors: lightColors,
  ready: false,
  saving: false,
  error: "",
  setDarkMode: preference.setDarkMode,
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    preference.subscribe,
    preference.getSnapshot,
    preference.getSnapshot,
  );
  useEffect(() => {
    void preference.restore();
  }, []);
  useEffect(() => {
    Appearance.setColorScheme(state.scheme);
  }, [state.scheme]);
  const value = useMemo<Theme>(
    () => ({
      ...state,
      colors: state.scheme === "dark" ? darkColors : lightColors,
      setDarkMode: preference.setDarkMode,
    }),
    [state],
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
