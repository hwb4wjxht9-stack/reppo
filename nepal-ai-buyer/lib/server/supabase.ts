import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the secret key. Never import this from a
// "use client" file: the key would leak to the browser.

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function db(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error("Supabase is not set up. See README → Step 2.");
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}
