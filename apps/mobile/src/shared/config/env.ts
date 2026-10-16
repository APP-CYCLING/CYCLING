const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export function getSupabaseConfig(): { url: string; key: string } {
  if (!url || !key) throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en apps/mobile/.env');
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('La URL de Supabase debe usar HTTP o HTTPS.');
  if (key.startsWith('sb_secret_')) throw new Error('Usa una clave pública de Supabase, nunca una clave secreta.');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const encoded = (key.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encoded)) as { role?: string };
      if (payload.role !== 'anon') throw new Error('Invalid role');
    } catch {
      throw new Error('Usa una clave publishable o anon válida de Supabase.');
    }
  }
  return { url, key };
}

export function getConfigurationError(): string | null {
  try { getSupabaseConfig(); return null; }
  catch (error: unknown) { return error instanceof Error ? error.message : 'Revisa la configuración de Supabase.'; }
}
