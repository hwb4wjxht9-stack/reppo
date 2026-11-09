"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, logIn, logOut } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/supabase";
import { normalizeNepalPhone } from "@/lib/phone";

export type FormState = { ok?: string; error?: string };

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not logged in");
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
  consent: boolean;
  notes: string | null;
};

function parseShop(raw: Record<string, string | undefined>): ShopInput | string {
  const name = raw.name?.trim();
  const area = raw.area?.trim();
  const category = raw.category?.trim().toLowerCase();
  const phone = normalizeNepalPhone(raw.phone ?? "");
  if (!name) return "Shop name is missing.";
  if (!phone) return `“${raw.phone ?? ""}” doesn't look like a Nepali phone number.`;
  if (!area) return "Area is missing.";
  if (category !== "grocery" && category !== "hardware") return "Category must be grocery or hardware.";
  return {
    name,
    phone,
    area,
    category,
    address: raw.address?.trim() || null,
    closes_at: raw.closes_at?.trim() || null,
    consent: raw.consent === "on" || raw.consent === "yes",
    notes: raw.notes?.trim() || null,
  };
}

function friendlyDbError(message: string, code?: string): string {
  if (code === "23505") return "A shop with that phone number already exists.";
  return message;
}

export async function addShopAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const shop = parseShop(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
  if (typeof shop === "string") return { error: shop };
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
  if (field !== "active" && field !== "consent") return;
  const value = form.get("value") === "true";
  await db().from("shops").update({ [field]: value }).eq("id", id);
  revalidatePath("/admin");
}

export async function deleteShopAction(form: FormData) {
  await requireAdmin();
  const { error } = await db().from("shops").delete().eq("id", String(form.get("id")));
  // A shop that already has calls can't be deleted (history would break):
  // switch it off instead.
  if (error) await db().from("shops").update({ active: false }).eq("id", String(form.get("id")));
  revalidatePath("/admin");
}
