"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import { rs } from "@/lib/data";
import { shop } from "@/lib/offers";
import { useStore } from "@/lib/store";

export default function Pickup() {
  const router = useRouter();
  const { order, items, reset } = useStore();
  const [showOrder, setShowOrder] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  if (!order) {
    return (
      <>
        <Header title="Pickup" step={5} back="/offers" />
        <p className="muted">No offer chosen yet.</p>
        <Link href="/offers" className="btn primary">
          See offers
        </Link>
      </>
    );
  }

  return (
    <>
      <Header title="Ready for pickup" step={5} back="/offers" />

      <div className="savings-banner">
        <div className="big-num">You saved {rs(order.savings)}</div>
        <div className="small">
          Saved {rs(order.savings)} · Our fee {rs(order.fee)} · the AI bargained this off the shops' first price
        </div>
      </div>

      {order.parts.map((p, i) => {
        const s = shop(p.shopId);
        return (
          <div key={p.shopId} className="card pickup">
            {order.parts.length > 1 && <div className="muted small">Pickup {i + 1} of {order.parts.length}</div>}
            <strong className="store">{s.name}</strong>
            <div>📍 {s.address}</div>
            <div>🕗 Pick up today before {s.closes} (closing time)</div>
            <div>📞 {s.phone}</div>
            <div className="row">
              <span className="muted">{p.itemIds.length} items</span>
              <strong>{rs(p.total)}</strong>
            </div>
            <div className="rate">
              <span className="small muted">After pickup, rate this shop:</span>
              <span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    aria-label={`${n} stars`}
                    className={n <= (ratings[s.id] ?? 0) ? "star on" : "star"}
                    onClick={() => setRatings({ ...ratings, [s.id]: n })}
                  >
                    ★
                  </button>
                ))}
              </span>
            </div>
          </div>
        );
      })}

      <div className="card totals">
        <div className="row">
          <span>Goods (pay at shop)</span>
          <span>{rs(order.total)}</span>
        </div>
        <div className="row">
          <span>Our fee</span>
          <span>{rs(order.fee)}</span>
        </div>
        <div className="row total">
          <span>Total</span>
          <span>{rs(order.total + order.fee)}</span>
        </div>
      </div>

      {showOrder && (
        <div className="card">
          <strong>Order</strong>
          <ul className="plain">
            {order.parts.flatMap((p) =>
              p.itemIds.map((id) => {
                const it = items.find((x) => x.id === id);
                return it ? (
                  <li key={p.shopId + id}>
                    {it.quantity} {it.unit} {it.name} <span className="muted small">— {shop(p.shopId).name}</span>
                  </li>
                ) : null;
              }),
            )}
          </ul>
        </div>
      )}
      {saved && <p className="note small">✔ Quote saved (prototype — not stored anywhere yet).</p>}

      <div className="button-row">
        <button className="btn secondary" onClick={() => setShowOrder(!showOrder)}>
          {showOrder ? "Hide Order" : "View Order"}
        </button>
        <button className="btn secondary" onClick={() => setSaved(true)}>
          Save Quote
        </button>
        <button
          className="btn primary"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          New Search
        </button>
      </div>
    </>
  );
}
