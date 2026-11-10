import { FEE, SHOPS, fakeQuotes, type ListItem, type Quote, type Shop } from "./data";
import type { Order } from "./store";

export type Option = Order & {
  id: string;
  title: string;
  /** Average of our ratings for the shops involved, null if none rated. */
  rating: number | null;
};

function shop(id: string): Shop {
  return SHOPS.find((s) => s.id === id)!;
}

function build(id: string, title: string, items: ListItem[], quotes: Quote[], pick: (item: ListItem) => Quote | undefined): Option | null {
  const byShop = new Map<string, { itemIds: string[]; total: number }>();
  let total = 0;
  let asked = 0;
  for (const item of items) {
    const q = pick(item);
    if (!q) return null; // every item must be covered, or it isn't a real option
    const part = byShop.get(q.shopId) ?? { itemIds: [], total: 0 };
    part.itemIds.push(item.id);
    part.total += q.finalPrice * item.quantity;
    byShop.set(q.shopId, part);
    total += q.finalPrice * item.quantity;
    asked += q.askedPrice * item.quantity;
  }
  const parts = [...byShop.entries()].map(([shopId, p]) => ({ shopId, ...p }));
  const rated = parts.map((p) => shop(p.shopId).ourRating).filter((r): r is number => r !== null);
  return {
    id,
    title,
    parts,
    total,
    savings: asked - total,
    fee: FEE,
    rating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null,
  };
}

export function buildOptions(items: ListItem[]) {
  const quotes = fakeQuotes(items);
  const q = (shopId: string, itemId: string) =>
    quotes.find((x) => x.shopId === shopId && x.itemId === itemId && x.available);
  const cheapestFor = (itemId: string) =>
    quotes
      .filter((x) => x.itemId === itemId && x.available)
      .sort((a, b) => a.finalPrice - b.finalPrice)[0];

  // One option per shop. If that shop is missing something, the missing items
  // come from the cheapest other shop, so the total always covers the full list.
  const perShop = SHOPS.map((s) =>
    build(s.id, s.name, items, quotes, (item) => q(s.id, item.id) ?? cheapestFor(item.id)),
  ).filter((o): o is Option => o !== null);

  const split = build("split", "Cheapest split", items, quotes, (item) => cheapestFor(item.id));

  const all = [...perShop];
  if (split && !perShop.some((o) => o.total === split.total && o.parts.length === split.parts.length)) all.push(split);

  const cheapest = [...all].sort((a, b) => a.total - b.total);
  const bestQuality = [...all].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.total - b.total);
  const missingCount = items.filter((it) => !cheapestFor(it.id)).length;

  return { all, cheapest, bestQuality, quotes, missingCount };
}

export { shop };
