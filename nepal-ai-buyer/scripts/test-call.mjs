// First real AI call test. Makes AT MOST ONE phone call and never retries.
//
//   node scripts/test-call.mjs check
//       Read-only: checks the Vapi key, lists your Vapi phone numbers and the
//       test shopper assistant. Calls nobody, costs nothing.
//
//   node scripts/test-call.mjs call --to +1XXXXXXXXXX --from <vapi phone number id> --assistant <assistant id> --yes
//       1. adds "Test Shop" (your number) and a list with 1 kg rice
//       2. places ONE call (max 2 minutes)
//       3. waits for it to end, saves transcript, first/final price and cost
//       4. prints them, then deletes the test shop and test list
//       Any failure stops the script and says why. Nothing is retried.
//
// Keys come from .env.local (or the environment): VAPI_API_KEY,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. They are never printed.

import { readEnvFile, cleanSupabaseUrl } from "./env-check.mjs";

const env = { ...readEnvFile(), ...process.env };
const VAPI = "https://api.vapi.ai";
const vapiKey = env.VAPI_API_KEY ?? "";
const dbUrl = cleanSupabaseUrl(env.SUPABASE_URL ?? "");
const dbKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const keyViaProxy = String(env.SUPABASE_KEY_FROM_PROXY ?? "").toLowerCase() === "true";

class Stop extends Error {}
const stop = (why) => {
  throw new Stop(why);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vapi(method, path, body) {
  if (!vapiKey) stop("VAPI_API_KEY is not set (add it to .env.local).");
  const res = await fetch(VAPI + path, {
    method,
    headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) stop(`Vapi ${method} ${path} failed (${res.status}): ${typeof data === "string" ? data : JSON.stringify(data.message ?? data)}`);
  return data;
}

async function db(method, path, body, prefer = "return=representation") {
  const headers = { apikey: dbKey, "Content-Type": "application/json", Prefer: prefer };
  if (!keyViaProxy && !dbKey.startsWith("sb_")) headers.Authorization = `Bearer ${dbKey}`;
  const res = await fetch(`${dbUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) stop(`Database ${method} ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function check() {
  const numbers = await vapi("GET", "/phone-number?limit=50");
  console.log(`Vapi key: OK`);
  console.log(`Vapi phone numbers: ${numbers.length || "NONE — create one in the Vapi dashboard (Phone Numbers)"}`);
  for (const n of numbers) console.log(`  ${n.id}  ${n.number ?? n.sipUri ?? "?"}  (${n.provider}, ${n.status ?? "?"})`);
  const assistants = await vapi("GET", "/assistant?limit=50");
  const shopper = assistants.find((a) => a.name === "AI Buyer test shopper (temporary)");
  console.log(`Test shopper assistant: ${shopper ? shopper.id : "not found"}`);
}

// Vapi's endedReason → our calls.status
function statusFrom(call) {
  const r = call.endedReason ?? "";
  if (/did-not-answer|no-answer|busy|voicemail/i.test(r)) return "no_answer";
  if (/error|failed|fault|unknown/i.test(r)) return "failed";
  return "ended";
}

function transcriptOf(call) {
  const msgs = call.artifact?.messages ?? call.messages ?? [];
  return msgs
    .filter((m) => m.role === "bot" || m.role === "assistant" || m.role === "user")
    .map((m) => ({ who: m.role === "user" ? "shop" : "ai", text: m.message ?? m.content ?? "", at: m.secondsFromStart ?? null }));
}

async function call() {
  const to = arg("--to");
  const phoneNumberId = arg("--from");
  const assistantId = arg("--assistant");
  if (!process.argv.includes("--yes")) stop("Add --yes to confirm you want ONE real phone call.");
  if (!/^\+\d{8,15}$/.test(to ?? "")) stop("--to must be a full number like +15551234567.");
  if (!phoneNumberId || !assistantId) stop("--from (Vapi phone number id) and --assistant are required. Run: node scripts/test-call.mjs check");
  if (!dbUrl || !dbKey) stop("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");

  // 1. Test data
  const [shop] = await db("POST", "shops", {
    name: "Test Shop",
    phone: to,
    area: "Test",
    category: "grocery",
    consent: true,
    notes: "Automated call test — safe to delete",
  });
  const [list] = await db("POST", "shopping_lists", { category: "grocery", status: "calling", raw_text: "1 kg rice" });
  const [item] = await db("POST", "list_items", { list_id: list.id, name: "rice", quantity: 1, unit: "kg", position: 0 });
  const [row] = await db("POST", "calls", { list_id: list.id, shop_id: shop.id, status: "queued" });
  console.log(`Test shop ${shop.id}, list ${list.id}, call row ${row.id} created.`);

  // 2. ONE call. No retries, whatever happens.
  const placed = await vapi("POST", "/call", {
    name: "AI Buyer test call",
    assistantId,
    phoneNumberId,
    customer: { number: to, name: "Test Shop" },
  });
  console.log(`Call placed: ${placed.id}. Waiting for it to finish (max 2 minutes of talking)…`);
  await db("PATCH", `calls?id=eq.${row.id}`, { vapi_call_id: placed.id, status: "ringing" }, "return=minimal");

  // 3. Wait for the end, then wait a little more for Vapi's analysis.
  let c = placed;
  const deadline = Date.now() + 6 * 60_000;
  while (c.status !== "ended") {
    if (Date.now() > deadline) stop(`Call ${placed.id} hasn't ended after 6 minutes. Check it in the Vapi dashboard.`);
    await sleep(5000);
    c = await vapi("GET", `/call/${placed.id}`);
    process.stdout.write(`  status: ${c.status}\r`);
  }
  for (let i = 0; i < 12 && !c.analysis?.structuredData && c.endedReason !== "customer-did-not-answer"; i++) {
    await sleep(5000);
    c = await vapi("GET", `/call/${placed.id}`);
  }

  const transcript = transcriptOf(c);
  const sd = c.analysis?.structuredData ?? {};
  const first = Number.isFinite(sd.first_price_npr) ? sd.first_price_npr : null;
  const final = Number.isFinite(sd.final_price_npr) ? sd.final_price_npr : first;
  await db(
    "PATCH",
    `calls?id=eq.${row.id}`,
    {
      status: statusFrom(c),
      transcript,
      summary: c.analysis?.summary ?? c.endedReason ?? null,
      cost_usd: c.cost ?? null,
      started_at: c.startedAt ?? null,
      ended_at: c.endedAt ?? null,
    },
    "return=minimal",
  );
  if (first !== null || final !== null) {
    await db("POST", "quotes", { call_id: row.id, list_item_id: item.id, asked_price: first, final_price: final, available: sd.available ?? true }, "return=minimal");
  }

  // 4. Show what was saved (read back from the database).
  const [saved] = await db("GET", `calls?id=eq.${row.id}&select=status,transcript,summary,cost_usd,started_at,ended_at`);
  const quotes = await db("GET", `quotes?call_id=eq.${row.id}&select=asked_price,final_price,available`);
  const secs = saved.started_at && saved.ended_at ? Math.round((new Date(saved.ended_at) - new Date(saved.started_at)) / 1000) : null;
  console.log("\n================ RESULT (read back from the database) ================");
  console.log(`Vapi call id : ${placed.id}`);
  console.log(`Status       : ${saved.status} (${c.endedReason ?? "?"})`);
  console.log(`Length       : ${secs ?? "?"} seconds`);
  console.log(`Cost         : ${saved.cost_usd != null ? "$" + Number(saved.cost_usd).toFixed(4) : "not reported"}`);
  console.log(`First price  : ${quotes[0]?.asked_price != null ? "Rs. " + quotes[0].asked_price + " / kg" : "not captured"}`);
  console.log(`Final price  : ${quotes[0]?.final_price != null ? "Rs. " + quotes[0].final_price + " / kg" : "not captured"}`);
  console.log(`Summary      : ${saved.summary ?? "-"}`);
  console.log("Transcript   :");
  for (const t of saved.transcript ?? []) console.log(`  ${t.who === "ai" ? "AI  " : "Shop"}: ${t.text}`);
  if (c.costBreakdown) console.log("Cost breakdown:", JSON.stringify(c.costBreakdown));
  console.log("======================================================================\n");

  // 5. Clean up: deleting the list also deletes its item, call row and quote.
  if (process.argv.includes("--keep")) return console.log("--keep given: test data left in the database.");
  await db("DELETE", `shopping_lists?id=eq.${list.id}`, null, "return=minimal");
  await db("DELETE", `shops?id=eq.${shop.id}`, null, "return=minimal");
  const left = [
    ...(await db("GET", `shops?id=eq.${shop.id}&select=id`)),
    ...(await db("GET", `shopping_lists?id=eq.${list.id}&select=id`)),
    ...(await db("GET", `calls?id=eq.${row.id}&select=id`)),
  ];
  console.log(left.length ? `⚠️ Clean-up incomplete: ${left.length} row(s) left.` : "Test shop and test list deleted (with their call record and quote).");
}

const cmd = process.argv[2];
try {
  if (cmd === "check") await check();
  else if (cmd === "call") await call();
  else console.log("Usage: node scripts/test-call.mjs check | call --to +1… --from <id> --assistant <id> --yes");
} catch (e) {
  console.error(`\n⛔ Stopped: ${e instanceof Stop ? e.message : e?.message ?? e}`);
  console.error("Nothing was retried.");
  process.exit(1);
}
