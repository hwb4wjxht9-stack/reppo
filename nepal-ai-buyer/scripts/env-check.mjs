// Shared checks used by `npm run doctor` and `npm run dev`.
// Plain Node, no packages, so it works even before `npm install`.
// It never prints secret values.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;

const QUOTES = /^["'“”‘’\s]+|["'“”‘’\s]+$/g;

export function readEnvFile() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return null;
  const env = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).replace(QUOTES, "");
  }
  return env;
}

/** Same rules as lib/server/supabase.ts → supabaseUrl(). */
export function cleanSupabaseUrl(raw = "") {
  const v = raw.replace(QUOTES, "");
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  let url = v.replace(/\s+/g, "");
  if (url && !/^https?:\/\//i.test(url))
    url = (/^(localhost|127\.)/i.test(url) ? "http://" : "https://") + url.replace(/^[a-z]+:\/*/i, "");
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function keyKind(key) {
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return payload.role === "service_role" ? "secret" : payload.role === "anon" ? "publishable" : "unknown";
    } catch {}
  }
  return "unknown";
}

/**
 * Returns a list of { ok, label, fix? }. `network: true` also tries to reach
 * Supabase and read the shops table.
 */
export async function checkEnv({ network = true } = {}) {
  const out = [];
  const add = (ok, label, fix) => out.push({ ok, label, fix });

  const env = readEnvFile();
  if (!env) {
    add(false, "Settings file .env.local is missing", "Run:  cp .env.example .env.local   then fill it in (see README → Step 2).");
    return out;
  }
  add(true, "Settings file .env.local found");

  const rawUrl = env.SUPABASE_URL ?? "";
  const url = cleanSupabaseUrl(rawUrl);
  if (!rawUrl) add(false, "SUPABASE_URL is empty", "Paste your Project URL after SUPABASE_URL= (Supabase → Project Settings → Data API).");
  else if (url.includes("your-project")) add(false, "SUPABASE_URL still has the example value", "Replace https://your-project.supabase.co with your real Project URL.");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url))
    add(false, `SUPABASE_URL doesn't look right: “${url}”`, "It must look exactly like https://abcdxyz.supabase.co — nothing after .co");
  else add(true, `SUPABASE_URL = ${url}`);

  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const kind = keyKind(key);
  if (!key) add(false, "SUPABASE_SERVICE_ROLE_KEY is empty", "Paste the service_role / secret key (Supabase → Project Settings → API Keys).");
  else if (kind === "publishable")
    add(false, "SUPABASE_SERVICE_ROLE_KEY is the public (anon / publishable) key", "Copy the service_role / SECRET key instead.");
  else if (key.length < 40) add(false, "SUPABASE_SERVICE_ROLE_KEY looks too short", "Copy the whole key with the copy button.");
  else add(true, `SUPABASE_SERVICE_ROLE_KEY set (${key.slice(0, 6)}…, hidden)`);

  const pw = env.ADMIN_PASSWORD ?? "";
  if (pw.length < 8) add(false, "ADMIN_PASSWORD is missing or shorter than 8 characters", "Type any password of 8+ characters after ADMIN_PASSWORD=");
  else add(true, "ADMIN_PASSWORD set (hidden)");

  if (!network || out.some((c) => !c.ok)) return out;

  const headers = { apikey: key };
  const viaProxy = (env.SUPABASE_KEY_FROM_PROXY ?? "").toLowerCase() === "true";
  if (!key.startsWith("sb_") && !viaProxy) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(`${url}/rest/v1/shops?select=id`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    if (res.ok) {
      const total = res.headers.get("content-range")?.split("/")[1] ?? "?";
      add(true, `Connected to Supabase — shops table has ${total} shop(s)`);
    } else if (res.status === 401 || res.status === 403 || /api key|apikey|JWT/i.test(body)) {
      add(false, "Supabase rejected the key", "Copy the service_role / secret key again into SUPABASE_SERVICE_ROLE_KEY.");
    } else if (/PGRST205|does not exist|Could not find the table/i.test(body)) {
      add(false, "Connected, but the tables don't exist yet", "Run supabase/schema.sql in Supabase → SQL Editor (see README → Step 2).");
    } else {
      add(false, `Supabase answered with an error (${res.status})`, body.slice(0, 200));
    }
  } catch (e) {
    add(
      false,
      `Can't reach ${url}`,
      "Check the URL, your internet, and that the project isn't paused (open it in the Supabase dashboard and click Restore if asked).",
    );
  }
  return out;
}

export function printChecks(checks) {
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} ${c.label}`);
    if (!c.ok && c.fix) console.log(`   → ${c.fix}`);
  }
}
