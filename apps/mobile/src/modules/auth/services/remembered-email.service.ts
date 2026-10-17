import AsyncStorage from "@react-native-async-storage/async-storage";
import { validEmail } from "../utils/auth-form";
const key = "cycling.auth.remembered-email.v1";
export const rememberedEmailService = {
  async load(): Promise<{ remember: boolean; email: string }> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { remember: true, email: "" };
    try {
      const value: unknown = JSON.parse(raw);
      if (
        value &&
        typeof value === "object" &&
        "remember" in value &&
        typeof value.remember === "boolean"
      ) {
        const email =
          "email" in value && typeof value.email === "string"
            ? value.email.trim()
            : "";
        return {
          remember: value.remember,
          email: value.remember && validEmail(email) ? email : "",
        };
      }
    } catch {
      /* Preferir un formulario vacío si el dato local está dañado. */
    }
    return { remember: false, email: "" };
  },
  async save(email: string, remember: boolean) {
    // Se escribe una lista explícita de campos; nunca contraseñas ni tokens.
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        remember,
        email: remember && validEmail(email) ? email.trim() : "",
      }),
    );
  },
};
