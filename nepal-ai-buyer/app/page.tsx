"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Header from "@/components/Header";
import { POPULAR_SEARCHES } from "@/lib/data";
import { parseList } from "@/lib/parseList";
import { useStore } from "@/lib/store";
import { createListAction } from "./list/actions";

const SAMPLE = "25 kg jeera masino rice\n2 litre mustard oil\n5 kg masoor dal\n3 kg sugar\n1 dozen eggs";

export default function Home() {
  const router = useRouter();
  const { setList } = useStore();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const count = parseList(text).length;

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await createListAction(text).catch(() => ({ error: "Couldn't reach the app. Is it still running?" }));
      if ("error" in res) return setError(res.error);
      if ("id" in res) return router.push(`/list/${res.id}`);
      // No database yet: keep the list in this browser.
      setList({ items: res.local.map((it, i) => ({ id: `l${i}`, ...it })), category: res.category, listId: null });
      router.push("/list");
    });
  }

  function quickAdd(label: string) {
    setText((t) => (t.trim() ? t.replace(/\s*$/, "\n") : "") + label);
  }

  return (
    <>
      <Header title="What do you need?" step={0} />
      <section className="hero">
        <p>
          Write your shopping list. Our AI calls Kathmandu shops in Nepali, bargains politely and brings back the best
          price.
        </p>
      </section>

      <div className="card">
        <label htmlFor="list" className="label">
          Your list
        </label>
        <textarea
          id="list"
          rows={6}
          placeholder={"25 kg rice\n2 litre mustard oil\n5 kg masoor dal\nचिनी ३ किलो"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="muted small">One item per line, in English or Nepali. Quantity and unit are optional.</p>
        {error && <p className="note error">{error}</p>}
        <button className="btn primary big" onClick={submit} disabled={count === 0 || busy}>
          {busy ? "Reading your list…" : count ? `Continue with ${count} ${count === 1 ? "item" : "items"}` : "Continue"}
        </button>
        <button className="link small" onClick={() => setText(SAMPLE)}>
          Try a sample list
        </button>
      </div>

      <div className="card soon">
        <button className="btn secondary" disabled aria-disabled>
          📷 Photo of a handwritten list
        </button>
        <span className="muted small">Coming soon</span>
      </div>

      <h2 className="section">Popular searches</h2>
      {(["grocery", "hardware"] as const).map((cat) => (
        <div key={cat} className="chips-block">
          <div className="muted small">{cat === "grocery" ? "🛒 Groceries" : "🔧 Hardware"}</div>
          <div className="chips">
            {POPULAR_SEARCHES.filter((p) => p.category === cat).map((p) => (
              <button key={p.label} className="chip" onClick={() => quickAdd(p.label)}>
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
