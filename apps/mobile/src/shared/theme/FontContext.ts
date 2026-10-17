import { createContext, useContext } from "react";
import { fonts } from "./typography";
export const FontReadyContext = createContext(false);
export function useFontFamily(weight: keyof typeof fonts = "regular") {
  return useContext(FontReadyContext) ? fonts[weight] : undefined;
}
