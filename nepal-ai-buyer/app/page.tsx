"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import { POPULAR_SEARCHES, SAMPLE_LIST } from "@/lib/data";
import { useStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const { setItems } = useStore();
  const [text, setText] = useState("");

  // In the prototype, a photo always "reads" as the sample list.
  function usePhoto() {
    setItems(SAMPLE_LIST);
    router.push("/list?from=photo");
  }

  function useText() {
    const lines = text
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setItems(
      lines.map((line, i) => {
        // "5 kg dal" → quantity 5, unit kg, name dal. Anything else → 1 piece.
        const m = line.match(/^(\d+(?:\.\d+)?)\s*(kg|g|litre|l|pcs|packet|bag)?\s+(.+)$/i);
        return m
          ? { id: `t${i}`, name: m[3], quantity: Number(m[1]), unit: m[2] ?? "pcs" }
          : { id: `t${i}`, name: line, quantity: 1, unit: "pcs" };
      }),
    );
    router.push("/list");
  }

  function quickAdd(label: string) {
    setText((t) => (t ? t + "\n" : "") + label);
  }

  return (
    <>
      <Header title="What do you need?" step={0} />
      <section className="hero">
        <p>
          Post your shopping list. Our AI calls Kathmandu shops in Nepali, bargains politely and brings back the best
          price.
        </p>
      </section>

      <div className="card">
        <button className="btn primary big" onClick={usePhoto}>
          📷 Take a photo of my list
        </button>
        <label className="btn secondary big upload">
          ⬆ Upload a list
          <input type="file" accept="image/*" onChange={usePhoto} hidden />
        </label>
      </div>

      <div className="card">
        <label htmlFor="list" className="label">
          Or type it
        </label>
        <textarea
          id="list"
          rows={4}
          placeholder={"25 kg rice\n2 litre mustard oil\n5 kg masoor dal"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn primary" onClick={useText} disabled={!text.trim()}>
          Continue
        </button>
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
