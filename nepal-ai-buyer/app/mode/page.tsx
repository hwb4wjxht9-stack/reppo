"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useStore, type Mode } from "@/lib/store";

const MODES: { id: Mode; title: string; body: string; icon: string }[] = [
  {
    id: "automatic",
    icon: "🤖",
    title: "Automatic",
    body: "The AI calls and bargains on its own. You get a notification when the best offers are ready.",
  },
  {
    id: "supervised",
    icon: "🎧",
    title: "Supervised",
    body: "Listen to calls live and send the AI hints, like “ask for a bigger discount”.",
  },
  {
    id: "manual",
    icon: "📞",
    title: "Manual",
    body: "The AI dials and introduces you, then hands the call to you to talk yourself.",
  },
];

export default function ChooseMode() {
  const { mode, setMode, items } = useStore();

  return (
    <>
      <Header title="How should we call?" step={2} back="/list" />
      <p className="muted">
        We'll call 4 nearby shops about your {items.length} items. Calls take about 10–20 minutes. You can leave the app
        while they run.
      </p>

      <div role="radiogroup" className="modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            className={`mode ${mode === m.id ? "selected" : ""}`}
            onClick={() => setMode(m.id)}
          >
            <span className="mode-icon">{m.icon}</span>
            <span>
              <strong>{m.title}</strong>
              <span className="muted small block">{m.body}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="note small">
        Every call starts with the AI saying it is an AI assistant calling for a customer.
      </p>

      <div className="footer">
        <Link href="/calls" className="btn primary big">
          Start calling shops
        </Link>
      </div>
    </>
  );
}
