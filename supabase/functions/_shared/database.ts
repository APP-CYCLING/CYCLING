export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };
type CacheRow = { cache_key: string; geojson: Json; expires_at: string };
export type MapDatabase = {
  public: {
    Tables: {
      osm_cycleway_cache: {
        Row: CacheRow;
        Insert: CacheRow;
        Update: Partial<CacheRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      consume_map_quota: {
        Args: { p_action: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
