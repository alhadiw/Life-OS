import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase URL or Anon Key is missing. Check your .env.local file.");
}

export const supabase = createClient<Database>(
    supabaseUrl || 'http://localhost:54321', // Fallback to avoid complete crash if missing
    supabaseAnonKey || 'public-anon-key'
);

/**
 * Row / insert / update shapes straight from the database schema.
 *
 * `database.types.ts` is generated — never edit it by hand. Regenerate it after
 * every migration with `npm run types`.
 */
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];

export type Insertable<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];

export type Enums<T extends keyof Database['public']['Enums']> =
    Database['public']['Enums'][T];
