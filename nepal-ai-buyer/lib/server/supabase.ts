import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the secret key. Never import this from a
// "use client" file: the key would leak to the browser.

let client: SupabaseClient | null = null;

/** Removes spaces and quote marks people often paste in by accident. */
function clean(v: string | undefined): string {
  return (v ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

/**
 * Accepts the Project URL in the forms people tend to paste:
 *   https://abcd.supabase.co            (correct)
 *   abcd.supabase.co                    (no https)
 *   https://abcd.supabase.co/rest/v1/   (API path)
 *   https://supabase.com/dashboard/project/abcd/... (the dashboard address)
 */
export function supabaseUrl(): string {
  const raw = clean(process.env.SUPABASE_URL);
  const dash = raw.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  let url = raw;
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function serviceKey(): string {
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseConfigured(): boolean {
  return Boolean(clean(process.env.SUPABASE_URL) && serviceKey());
}

/** Spots the most common setup mistakes before we even try to connect. */
export function supabaseSetupProblem(): string | null {
  const url = supabaseUrl();
  if (url.includes("your-project")) return "SUPABASE_URL still has the example value “your-project”.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url))
    return `SUPABASE_URL should look like https://abcdxyz.supabase.co, but it is “${url}”.`;
  const key = serviceKey();
  if (key.length < 40) return "SUPABASE_SERVICE_ROLE_KEY looks too short. Copy the whole key.";
  return null;
}

export function db(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error("Supabase is not set up. See README → Step 2.");
  client ??= createClient(supabaseUrl(), serviceKey(), { auth: { persistSession: false } });
  return client;
}

/** Turns database errors into advice a non-developer can act on. */
export function explainDbError(message: string): string {
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(message))
    return `Can't reach Supabase at ${supabaseUrl()}. Check SUPABASE_URL in .env.local, that your internet works, and that the project isn't paused in the Supabase dashboard.`;
  if (/Invalid API key|JWT|401|apikey/i.test(message))
    return "Supabase rejected the key. Copy the service_role (secret) key again into SUPABASE_SERVICE_ROLE_KEY.";
  if (/relation .* does not exist|Could not find the table/i.test(message))
    return "The tables don't exist yet. Run supabase/schema.sql in Supabase → SQL Editor.";
  return message;
}
