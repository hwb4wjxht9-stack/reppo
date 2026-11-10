"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { SHOPS, fakeTranscript } from "@/lib/data";
import { useStore } from "@/lib/store";

type Status = "queued" | "ringing" | "talking" | "done" | "no-answer";

const STATUS_LABEL: Record<Status, string> = {
  queued: "Waiting",
  ringing: "Ringing…",
  talking: "Bargaining",
  done: "Quote received",
  "no-answer": "No answer — will retry",
};

// The prototype fast-forwards: each "tick" is ~1 second instead of minutes.
function statusAt(shopIndex: number, tick: number): { status: Status; lines: number } {
  const start = shopIndex * 3;
  if (tick < start) return { status: "queued", lines: 0 };
  if (tick < start + 2) return { status: "ringing", lines: 0 };
  if (shopIndex === 3 && tick < start + 6) return { status: "no-answer", lines: 0 };
  const talkStart = shopIndex === 3 ? start + 6 : start + 2;
  const lines = tick - talkStart + 1;
  if (lines < 8) return { status: "talking", lines };
  return { status: "done", lines: 8 };
}

export default function Calls() {
  const { items, mode } = useStore();
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(SHOPS[0].id);
  const [listening, setListening] = useState<string | null>(null);
  const [takenOver, setTakenOver] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const states = SHOPS.map((_, i) => statusAt(i, tick));
  const doneCount = states.filter((s) => s.status === "done").length;
  const allDone = doneCount === SHOPS.length;

  return (
    <>
      <Header title="Calling shops" step={3} back="/mode" />
      <div className="progress-card">
        <div>
          <strong>
            {doneCount} of {SHOPS.length} shops done
          </strong>
          <div className="muted small">
            Mode: {mode} · you can leave the app, we'll notify you
          </div>
        </div>
        <div className="bar">
          <div style={{ width: `${(doneCount / SHOPS.length) * 100}%` }} />
        </div>
      </div>

      <ul className="calls">
        {SHOPS.map((shop, i) => {
          const s = states[i];
          const transcript = fakeTranscript(shop, items).slice(0, s.lines);
          const live = s.status === "talking" || s.status === "ringing";
          return (
            <li key={shop.id} className={`call ${s.status}`}>
              <button className="call-head" onClick={() => setOpen(open === shop.id ? null : shop.id)}>
                <span className={`dot ${s.status}`} />
                <span className="grow">
                  <strong>{shop.name}</strong>
                  <span className="muted small block">
                    {shop.area} · {STATUS_LABEL[s.status]}
                  </span>
                </span>
                <span className="muted">{open === shop.id ? "▾" : "▸"}</span>
              </button>

              {open === shop.id && (
                <div className="call-body">
                  {transcript.length === 0 ? (
                    <p className="muted small">Transcript appears here once the shop picks up.</p>
                  ) : (
                    <ul className="transcript">
                      {transcript.map((l, k) => (
                        <li key={k} className={l.who}>
                          <span className="who">{l.who === "ai" ? "AI" : "Shop"}</span>
                          <span>
                            {l.ne}
                            <span className="muted small block">{l.en}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {live && (
                    <div className="call-actions">
                      <button
                        className="btn secondary"
                        onClick={() => setListening(listening === shop.id ? null : shop.id)}
                      >
                        {listening === shop.id ? "🔇 Stop listening" : "🎧 Listen Live"}
                      </button>
                      <button className="btn danger" onClick={() => setTakenOver(shop.id)}>
                        📞 Take Over Call
                      </button>
                    </div>
                  )}
                  {listening === shop.id && live && (
                    <p className="note small">🔊 (Prototype) You'd hear the call audio here.</p>
                  )}
                  {takenOver === shop.id && (
                    <p className="note small">
                      📞 (Prototype) The call would now ring your phone and the AI would step out.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="footer">
        <Link href="/offers" className={`btn primary big ${allDone ? "" : "soft"}`}>
          {allDone ? "See best offers" : "See offers so far"}
        </Link>
      </div>
    </>
  );
}
