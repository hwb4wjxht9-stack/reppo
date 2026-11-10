"use server";

import { guessCategory, parseList, UNITS, type ParsedItem } from "@/lib/parseList";
import { db, explainDbError, supabaseConfigured, supabaseSetupProblem } from "@/lib/server/supabase";

// NOTE: there are no customer accounts yet, so a list is reachable by anyone
// who has its link (the id is a long random UUID). Customer login comes later.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 100;

export type Category = "grocery" | "hardware";

export type CreateResult =
  | { id: string }
  | { local: ParsedItem[]; category: Category } // database not set up: keep the list in the browser
  | { error: string };

function databaseReady(): boolean {
  return supabaseConfigured() && !supabaseSetupProblem();
}

export async function createListAction(text: string): Promise<CreateResult> {
  if (typeof text !== "string" || text.length > 20_000) return { error: "That list is too long." };
  const items = parseList(text, MAX_ITEMS);
  if (items.length === 0) return { error: "Type at least one item." };
  const category = guessCategory(items);

  if (!databaseReady()) return { local: items, category };

  const { data: list, error } = await db()
    .from("shopping_lists")
    .insert({ category, status: "draft", raw_text: text })
    .select("id")
    .single();
  if (error || !list) return { error: explainDbError(error?.message ?? "Couldn't save the list.") };

  const { error: itemsError } = await db()
    .from("list_items")
    .insert(items.map((it, position) => ({ list_id: list.id, ...it, position })));
  if (itemsError) {
    await db().from("shopping_lists").delete().eq("id", list.id);
    return { error: explainDbError(itemsError.message) };
  }
  return { id: list.id };
}

export type SaveInput = {
  category: Category;
  items: { name: string; quantity: number; unit: string }[];
};

export type SaveResult = { ok: true; savedAt: string } | { error: string };

function validate(input: SaveInput): SaveInput | string {
  if (!input || (input.category !== "grocery" && input.category !== "hardware")) return "Choose grocery or hardware.";
  if (!Array.isArray(input.items)) return "Something went wrong. Reload the page.";
  if (input.items.length > MAX_ITEMS) return `A list can have at most ${MAX_ITEMS} items.`;
  const items = [];
  for (const [i, it] of input.items.entries()) {
    const name = String(it?.name ?? "").trim().slice(0, 80);
    const quantity = Number(it?.quantity);
    const unit = String(it?.unit ?? "");
    if (!name) return `Item ${i + 1} has no name.`;
    if (!Number.isFinite(quantity) || quantity <= 0) return `“${name}” needs a quantity above 0.`;
    if (quantity > 100_000) return `“${name}” quantity is too big.`;
    if (!(UNITS as readonly string[]).includes(unit)) return `“${name}” has an unknown unit.`;
    items.push({ name, quantity: Math.round(quantity * 1000) / 1000, unit });
  }
  return { category: input.category, items };
}

export async function saveListAction(id: string, input: SaveInput): Promise<SaveResult> {
  if (!UUID.test(String(id))) return { error: "Unknown list." };
  const clean = validate(input);
  if (typeof clean === "string") return { error: clean };
  if (!databaseReady()) return { error: "The database isn't connected. Run npm run doctor." };

  const { data: list, error } = await db().from("shopping_lists").select("id, status").eq("id", id).maybeSingle();
  if (error) return { error: explainDbError(error.message) };
  if (!list) return { error: "This list no longer exists." };
  if (list.status !== "draft") return { error: "This list is already being called about, so it can't be changed." };

  // Replace the items with the new version.
  const del = await db().from("list_items").delete().eq("list_id", id);
  if (del.error) return { error: explainDbError(del.error.message) };
  if (clean.items.length) {
    const ins = await db()
      .from("list_items")
      .insert(clean.items.map((it, position) => ({ list_id: id, ...it, position })));
    if (ins.error) return { error: explainDbError(ins.error.message) };
  }
  const savedAt = new Date().toISOString();
  await db().from("shopping_lists").update({ category: clean.category, updated_at: savedAt }).eq("id", id);
  return { ok: true, savedAt };
}
