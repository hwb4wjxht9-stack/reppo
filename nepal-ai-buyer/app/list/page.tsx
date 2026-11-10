"use client";

// Used only when no database is connected: the list stays in this browser.
import Header from "@/components/Header";
import ListEditor from "@/components/ListEditor";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function LocalList() {
  const { items, category } = useStore();
  // Wait one tick so the saved list is loaded from the browser first.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <Header title="Check your list" step={1} back="/" />
      <p className="note small">Not connected to the database, so this list is only saved in this browser.</p>
      {ready && <ListEditor initialItems={items} initialCategory={category} />}
    </>
  );
}
