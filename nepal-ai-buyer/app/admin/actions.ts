"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, logIn, logOut } from "@/lib/server/admin-auth";
import { db, explainDbError } from "@/lib/server/supabase";
import { parseLocation } from "@/lib/location";
import { normalizeNepalPhone } from "@/lib/phone";

export type FormState = { ok?: string; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("You've been logged out. Reload the page and log in again.");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const ok = await logIn(String(form.get("password") ?? ""));
  if (!ok) return { error: "Wrong password." };
  redirect("/admin");
}

export async function logoutAction() {
  await logOut();
  redirect("/admin");
}

type ShopInput = {
  name: string;
  phone: string;
  area: string;
  category: "grocery" | "hardware";
  address: string | null;
  closes_at: string | null;
  lat: number | null;
  lng: number | null;
  consent: boolean;
  notes: string | null;
};

const LIMITS: Record<string, number> = { name: 100, area: 60, address: 200, closes_at: 30, notes: 300 };

function parseShop(raw: Record<string, string | undefined>): ShopInput | string {
  for (const [field, max] of Object.entries(LIMITS)) {
    if ((raw[field]?.length ?? 0) > max) return `${field.replace("_", " ")} is too long (max ${max} characters).`;
  }
  const name = raw.name?.trim();
  const area = raw.area?.trim();
  const category = raw.category?.trim().toLowerCase();
  const phone = normalizeNepalPhone(raw.phone ?? "");
  if (!name) return "Shop name is missing.";
  if (!phone) return `“${raw.phone ?? ""}” doesn't look like a Nepali phone number.`;
  if (!area) return "Area is missing.";
  if (category !== "grocery" && category !== "hardware") return "Category must be grocery or hardware.";
  const loc = parseLocation(raw.location ?? "");
  if (loc && "error" in loc) return loc.error;
  return {
    name,
    phone,
    area,
    category,
    address: raw.address?.trim() || null,
    closes_at: raw.closes_at?.trim() || null,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    consent: raw.consent === "on" || raw.consent === "yes",
    notes: raw.notes?.trim() || null,
  };
}

function friendlyDbError(message: string, code?: string): string {
  if (code === "23505") return "A shop with that phone number already exists.";
  return explainDbError(message);
}

function fields(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

/** Adds a new shop, or updates one when the form has an id. */
export async function saveShopAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = fields(form);
  const shop = parseShop(raw);
  if (typeof shop === "string") return { error: shop };

  if (raw.id) {
    if (!UUID.test(raw.id)) return { error: "Unknown shop." };
    const { error, count } = await db().from("shops").update(shop, { count: "exact" }).eq("id", raw.id);
    if (error) return { error: friendlyDbError(error.message, error.code) };
    if (count === 0) return { error: "That shop no longer exists. Reload the page." };
    revalidatePath("/admin");
    return { ok: `Saved changes to ${shop.name}.` };
  }

  const { error } = await db().from("shops").insert(shop);
  if (error) return { error: friendlyDbError(error.message, error.code) };
  revalidatePath("/admin");
  return { ok: `Added ${shop.name}.` };
}

// Paste many shops at once, one per line:
// name, phone, area, category[, closing time]
export async function bulkAddAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const lines = String(form.get("bulk") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.toLowerCase().startsWith("name,"));
  if (lines.length === 0) return { error: "Nothing to add." };
  if (lines.length > 500) return { error: "Please add at most 500 shops at a time." };

  const rows: ShopInput[] = [];
  for (const [i, line] of lines.entries()) {
    const [name, phone, area, category, closes_at] = line.split(",").map((s) => s.trim());
    const shop = parseShop({ name, phone, area, category, closes_at });
    if (typeof shop === "string") return { error: `Line ${i + 1}: ${shop} Nothing was added.` };
    rows.push(shop);
  }
  const { error } = await db().from("shops").insert(rows);
  if (error) return { error: friendlyDbError(error.message, error.code) + " Nothing was added." };
  revalidatePath("/admin");
  return { ok: `Added ${rows.length} shops.` };
}

export async function toggleShopAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const field = String(form.get("field"));
  if (!UUID.test(id) || (field !== "active" && field !== "consent")) return;
  const value = form.get("value") === "true";
  await db().from("shops").update({ [field]: value }).eq("id", id);
  revalidatePath("/admin");
}

export async function deleteShopAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id"));
  if (!UUID.test(id)) return { error: "Unknown shop." };
  const { error } = await db().from("shops").delete().eq("id", id);
  if (error) {
    // A shop that already has calls can't be deleted without losing that
    // history, so pause it instead.
    if (error.code === "23503") {
      await db().from("shops").update({ active: false }).eq("id", id);
      revalidatePath("/admin");
      return { ok: "This shop has call history, so it was paused instead of deleted." };
    }
    return { error: explainDbError(error.message) };
  }
  revalidatePath("/admin");
  return { ok: "Deleted." };
}
