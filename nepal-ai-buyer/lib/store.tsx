"use client";

// Keeps the prototype's state (the list, the mode, the chosen offer) while you
// tap between screens. Saved in the browser so a refresh doesn't lose it.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SAMPLE_LIST, type ListItem } from "./data";

export type Mode = "automatic" | "supervised" | "manual";

export type Order = {
  /** One entry per shop the list is split across. */
  parts: { shopId: string; itemIds: string[]; total: number }[];
  total: number;
  savings: number;
  fee: number;
};

type State = {
  items: ListItem[];
  mode: Mode;
  order: Order | null;
};

type Store = State & {
  setItems: (items: ListItem[]) => void;
  setMode: (mode: Mode) => void;
  setOrder: (order: Order | null) => void;
  reset: () => void;
};

const KEY = "nepal-ai-buyer-prototype";
const initial: State = { items: SAMPLE_LIST, mode: "automatic", order: null };

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
