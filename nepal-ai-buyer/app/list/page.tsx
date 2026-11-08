"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import type { ListItem } from "@/lib/data";
import { useStore } from "@/lib/store";

function ConfirmList() {
  const { items, setItems } = useStore();
  const fromPhoto = useSearchParams().get("from") === "photo";

  function update(id: string, patch: Partial<ListItem>) {
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  return (
    <>
      <Header title="Confirm your list" step={1} back="/" />
      {fromPhoto && <p className="note">✨ AI read {items.length} items from your photo. Check them below.</p>}

      <ul className="items">
        {items.map((it) => (
          <li key={it.id} className="item-row">
            <input
              className="item-name"
              value={it.name}
              aria-label="Item name"
              onChange={(e) => update(it.id, { name: e.target.value })}
            />
            <div className="qty">
              <button aria-label="Less" onClick={() => update(it.id, { quantity: Math.max(1, it.quantity - 1) })}>
                −
              </button>
              <span>
                {it.quantity} {it.unit}
              </span>
              <button aria-label="More" onClick={() => update(it.id, { quantity: it.quantity + 1 })}>
                +
              </button>
            </div>
            <button
              className="remove"
              aria-label={`Remove ${it.name}`}
              onClick={() => setItems(items.filter((x) => x.id !== it.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        className="btn secondary"
        onClick={() => setItems([...items, { id: `n${Date.now()}`, name: "New item", quantity: 1, unit: "pcs" }])}
      >
        + Add item
      </button>

      <div className="footer">
        <Link href="/mode" className={`btn primary big ${items.length === 0 ? "disabled" : ""}`}>
          Looks right — find prices
        </Link>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ConfirmList />
    </Suspense>
  );
}
