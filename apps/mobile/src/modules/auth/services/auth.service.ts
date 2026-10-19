import type { LoginInput, RegisterInput, User } from "@cycling/contracts";
import { getSupabase } from "../../../shared/supabase/client";
import type { Session } from "@supabase/supabase-js";
export function sessionToUser(session: Session | null): User | null {
  const u = session?.user;
  return u
    ? {
        id: u.id,
        email: u.email ?? "",
        name: String(
          u.user_metadata?.name ??
            u.user_metadata?.full_name ??
            u.email?.split("@")[0] ??
            "Ciclista",
        ),
      }
    : null;
}
export const authService = {
  async login(input: LoginInput) {
    const { data, error } = await getSupabase().auth.signInWithPassword(input);
    if (error) throw error;
    return sessionToUser(data.session);
  },
  async register(input: RegisterInput) {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name } },
    });
    if (error) throw error;
    return {
      user: sessionToUser(data.session),
      needsConfirmation: !data.session,
    };
  },
  async logout() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },
};
