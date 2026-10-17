import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { StartupScreen } from "../../../shared/components/StartupScreen";
import { restoreSession } from "../services/session-restore";
import type { LoginInput, RegisterInput, User } from "@cycling/contracts";
import { getSupabase } from "../../../shared/supabase/client";
import { authService, sessionToUser } from "../services/auth.service";
type AuthContextType = {
  user: User | null;
  ready: boolean;
  login: (d: LoginInput) => Promise<void>;
  register: (d: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
};
const Context = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setReady(false);
    setError("");
    setUser(null);
    let stopRestore: (() => void) | undefined;
    let listener: ReturnType<typeof AppState.addEventListener> | null = null;
    let auth: ReturnType<typeof getSupabase>["auth"] | undefined;
    try {
      auth = getSupabase().auth;
      stopRestore = restoreSession(auth, ({ session, error: restoreError }) => {
        setUser(sessionToUser(session));
        setError(restoreError);
        setReady(true);
      });
      const refresh = (state: string) => {
        if (!auth) return;
        void (
          state === "active" ? auth.startAutoRefresh() : auth.stopAutoRefresh()
        ).catch(() => {});
      };
      if (Platform.OS !== "web") refresh(AppState.currentState);
      listener =
        Platform.OS !== "web"
          ? AppState.addEventListener("change", refresh)
          : null;
    } catch {
      setError("No se pudo iniciar la sesion. Pulsa Reintentar.");
      setReady(true);
    }
    return () => {
      stopRestore?.();
      listener?.remove();
      if (Platform.OS !== "web" && auth)
        void auth.stopAutoRefresh().catch(() => {});
    };
  }, [attempt]);
  const login = useCallback(async (d: LoginInput) => {
    await authService.login(d);
  }, []);
  const register = useCallback(async (d: RegisterInput) => {
    const result = await authService.register(d);
    return result.needsConfirmation;
  }, []);
  const logout = useCallback(async () => {
    await authService.logout();
  }, []);
  if (!ready)
    return <StartupScreen loading message="Recuperando tu cuenta..." />;
  if (error)
    return (
      <StartupScreen
        title="No se pudo recuperar tu cuenta"
        message={error}
        onRetry={() => setAttempt((v) => v + 1)}
      />
    );
  return (
    <Context.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const v = useContext(Context);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
