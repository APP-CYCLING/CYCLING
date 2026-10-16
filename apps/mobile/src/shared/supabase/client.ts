import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config/env';
// La clave publicable es segura en el cliente únicamente si RLS y permisos están bien configurados.
// NUNCA colocar service_role ni secretos de BD en la aplicación.
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    client = createClient(url, key, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}
