"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Header from "@/components/Header";
import { rs } from "@/lib/data";
import { buildOptions, shop, type Option } from "@/lib/offers";
import { useStore } from "@/lib/store";

type Tab = "all" | "cheapest" | "quality";

export default function Offers() {
  const router = useRouter();
  const { items, setOrder } = useStore();
  const [tab, setTab] = useState<Tab>("cheapest");
  const [open, setOpen] = useState<string | null>(null);
  const { all, cheapest, bestQuality, quotes, missingCount } = useMemo(() => buildOptions(items), [items]);

  const list = tab === "all" ? all : tab === "cheapest" ? cheapest : bestQuality;
  const best = cheapest[0];

  function choose(o: Option) {
    setOrder({ parts: o.parts, total: o.total, savings: o.savings, fee: o.fee });
    router.push("/pickup");
  }

  return (
    <>
      <Header title="Best offers" step={4} back="/calls" />
      {missingCount > 0 && (
        <p className="note">⚠ {missingCount} item(s) weren't available at any shop we called.</p>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            ["all", "All"],
            ["cheapest", "Cheapest"],
            ["quality", "Best Quality"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <ul className="offers">
        {list.map((o) => {
          const split = o.parts.length > 1;
          return (
            <li key={o.id} className={`offer ${o === best ? "best" : ""}`}>
              {o === best && <span className="tag">Lowest total</span>}
              <div className="offer-head">
                <div className="grow">
                  <strong>{split ? `${o.parts.length} shops` : shop(o.parts[0].shopId).name}</strong>
                  <div className="muted small">
                    {o.parts.map((p) => shop(p.shopId).area).join(" + ")} ·{" "}
                    {o.rating !== null ? `★ ${o.rating} our rating` : "New shop, not rated yet"}
                  </div>
                </div>
                <div className="price">
                  <strong>{rs(o.total)}</strong>
                  <div className="save small">Saved {rs(o.savings)}</div>
                </div>
              </div>
              <div className="muted small">
                All {items.length} items included{split ? " · list is split across shops" : ""}
              </div>

              <button className="link small" onClick={() => setOpen(open === o.id ? null : o.id)}>
                {open === o.id ? "Hide prices" : "Price per item"}
              </button>
              {open === o.id && (
                <table className="breakdown">
                  <tbody>
                    {o.parts.flatMap((p) =>
                      p.itemIds.map((itemId) => {
                        const it = items.find((x) => x.id === itemId)!;
                        const qu = quotes.find((x) => x.shopId === p.shopId && x.itemId === itemId)!;
                        return (
                          <tr key={p.shopId + itemId}>
                            <td>
                              {it.name}
                              <div className="muted small">
                                {it.quantity} {it.unit} × {rs(qu.finalPrice)}
                                {split && ` · ${shop(p.shopId).name}`}
                              </div>
                            </td>
                            <td className="num">
                              <s className="muted small">{rs(qu.askedPrice * it.quantity)}</s>
                              <div>{rs(qu.finalPrice * it.quantity)}</div>
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              )}

              <button className="btn primary" onClick={() => choose(o)}>
                Choose this
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
