"use client";

// Keeps the customer's place while they move between screens (the list, the
// mode, the chosen offer). Saved in the browser so a refresh doesn't lose it.
// The list itself is saved in the database when one is connected; `listId`
// points to it.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SAMPLE_LIST, type ListItem } from "./data";

export type Mode = "automatic" | "supervised" | "manual";
export type Category = "grocery" | "hardware";

export type Order = {
  /** One entry per shop the list is split across. */
  parts: { shopId: string; itemIds: string[]; total: number }[];
  total: number;
  savings: number;
  fee: number;
};

type State = {
  items: ListItem[];
  category: Category;
  listId: string | null;
  mode: Mode;
  order: Order | null;
};

type Store = State & {
  setItems: (items: ListItem[]) => void;
  setList: (list: { items: ListItem[]; category: Category; listId: string | null }) => void;
  setMode: (mode: Mode) => void;
  setOrder: (order: Order | null) => void;
  reset: () => void;
};

const KEY = "nepal-ai-buyer-prototype";
const initial: State = { items: SAMPLE_LIST, category: "grocery", listId: null, mode: "automatic", order: null };

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setState({ ...initial, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const store: Store = {
    ...state,
    setItems: (items) => setState((s) => ({ ...s, items, order: null })),
    setList: ({ items, category, listId }) => setState((s) => ({ ...s, items, category, listId, order: null })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setOrder: (order) => setState((s) => ({ ...s, order })),
    reset: () => setState(initial),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
