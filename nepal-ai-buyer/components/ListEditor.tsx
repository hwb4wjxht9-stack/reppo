"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveListAction, type Category } from "@/app/list/actions";
import { parseList, UNITS } from "@/lib/parseList";
import { useStore } from "@/lib/store";

type Row = { key: string; id?: string; name: string; quantity: string; unit: string };
type SaveStatus = "saved" | "dirty" | "saving" | "error";

let counter = 0;
const newKey = () => `row-${Date.now()}-${counter++}`;

function toRows(items: { id?: string; name: string; quantity: number; unit: string }[]): Row[] {
  return items.map((it) => ({ key: it.id ?? newKey(), id: it.id, name: it.name, quantity: String(it.quantity), unit: it.unit }));
}

function rowProblem(r: Row): string | null {
  if (!r.name.trim()) return "Add a name";
  const q = Number(r.quantity);
  if (!r.quantity.trim() || !Number.isFinite(q) || q <= 0) return "Quantity must be above 0";
  return null;
}

/**
 * Edits a shopping list. With `listId` every change is saved to the database
 * automatically; without it (no database yet) the list lives in this browser.
 */
export default function ListEditor({
  listId,
  initialItems,
  initialCategory,
}: {
  listId?: string;
  initialItems: { id?: string; name: string; quantity: number; unit: string }[];
  initialCategory: Category;
}) {
  const router = useRouter();
  const store = useStore();
  const [rows, setRows] = useState<Row[]>(() => toRows(initialItems));
  const [category, setCategory] = useState<Category>(initialCategory);
  const [more, setMore] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const first = useRef(true);
  const pending = useRef<Promise<boolean> | null>(null);

  const problems = rows.map(rowProblem);
  const valid = rows.length > 0 && problems.every((p) => p === null);

  function payload() {
    return {
      category,
      items: rows.map((r) => ({ name: r.name.trim(), quantity: Number(r.quantity), unit: r.unit })),
    };
  }

  async function save(): Promise<boolean> {
    if (!listId) return true;
    if (!valid) return false;
    setStatus("saving");
    const res = await saveListAction(listId, payload());
    if ("error" in res) {
      setStatus("error");
      setError(res.error);
      return false;
    }
    setStatus("saved");
    setError("");
    return true;
  }

  // Save automatically shortly after each change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!listId) {
      if (!valid) return;
      store.setList({ items: payload().items.map((it, i) => ({ id: rows[i].key, ...it })), category, listId: null });
      return;
    }
    setStatus("dirty");
    if (!valid) return;
    const t = setTimeout(() => {
      pending.current = save();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, category]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function step(key: string, delta: number) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const q = Number(r.quantity) || 0;
        // Whole steps above 1, quarter steps below (½ kg, ¼ kg…).
        const stepSize = q > 1 || (q === 1 && delta > 0) ? 1 : 0.25;
        const next = Math.max(0.25, Math.round((q + delta * stepSize) * 100) / 100);
        return { ...r, quantity: String(next) };
      }),
    );
  }

  function addMore() {
    const parsed = parseList(more);
    if (parsed.length === 0) return;
    setRows((rs) => [...rs, ...toRows(parsed)].slice(0, 100));
    setMore("");
  }

  async function continueToMode() {
    setLeaving(true);
    if (pending.current) await pending.current;
    const ok = await save();
    if (!ok) {
      setLeaving(false);
      return;
    }
    store.setList({
      items: rows.map((r) => ({ id: r.id ?? r.key, name: r.name.trim(), quantity: Number(r.quantity), unit: r.unit })),
      category,
      listId: listId ?? null,
    });
    router.push("/mode");
  }

  return (
    <>
      <div className="list-toolbar">
        <div className="seg" role="radiogroup" aria-label="Which kind of shop?">
          {(["grocery", "hardware"] as const).map((c) => (
            <button key={c} role="radio" aria-checked={category === c} className={category === c ? "on" : ""} onClick={() => setCategory(c)}>
              {c === "grocery" ? "🛒 Grocery" : "🔧 Hardware"}
            </button>
          ))}
        </div>
        {listId && (
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saved" && "✓ Saved"}
            {status === "saving" && "Saving…"}
            {status === "dirty" && (valid ? "Saving soon…" : "Fix the red items to save")}
            {status === "error" && "Not saved"}
          </span>
        )}
      </div>
      {error && <p className="note error">{error}</p>}

      <ul className="items">
        {rows.map((r, i) => (
          <li key={r.key} className={`item-row2 ${problems[i] ? "bad" : ""}`}>
            <input
              className="item-name"
              value={r.name}
              maxLength={80}
              aria-label="Item name"
              placeholder="Item name"
              onChange={(e) => update(r.key, { name: e.target.value })}
            />
            <button className="remove" aria-label={`Remove ${r.name || "item"}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
              ✕
            </button>
            <div className="qty2">
              <button aria-label="Less" onClick={() => step(r.key, -1)}>
                −
              </button>
              <input
                className="qty-input"
                inputMode="decimal"
                aria-label={`Quantity of ${r.name}`}
                value={r.quantity}
                onChange={(e) => update(r.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
              />
              <button aria-label="More" onClick={() => step(r.key, 1)}>
                +
              </button>
              <select className="unit" aria-label={`Unit of ${r.name}`} value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {problems[i] && <span className="row-problem">{problems[i]}</span>}
          </li>
        ))}
        {rows.length === 0 && <li className="muted">Your list is empty. Add items below.</li>}
      </ul>

      <div className="card">
        <label className="label" htmlFor="more">
          Add more items
        </label>
        <textarea id="more" rows={2} value={more} onChange={(e) => setMore(e.target.value)} placeholder={"3 kg sugar\n1 dozen eggs"} />
        <div className="button-row">
          <button className="btn secondary" onClick={addMore} disabled={!more.trim()}>
            + Add these
          </button>
          <button
            className="btn secondary"
            onClick={() => setRows((rs) => [...rs, { key: newKey(), name: "", quantity: "1", unit: "pcs" }])}
          >
            + Blank item
          </button>
        </div>
      </div>

      <div className="footer">
        <button className="btn primary big" onClick={continueToMode} disabled={!valid || leaving}>
          {leaving ? "Saving…" : `Looks right: find prices (${rows.length} ${rows.length === 1 ? "item" : "items"})`}
        </button>
      </div>
    </>
  );
}
