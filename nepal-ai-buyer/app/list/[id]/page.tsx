import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ListEditor from "@/components/ListEditor";
import { db, explainDbError, supabaseConfigured, supabaseSetupProblem } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your list — Nepal AI Buyer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SavedList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !supabaseConfigured() || supabaseSetupProblem()) notFound();

  const [{ data: list, error }, { data: items, error: itemsError }] = await Promise.all([
    db().from("shopping_lists").select("id, category, status").eq("id", id).maybeSingle(),
    db().from("list_items").select("id, name, quantity, unit").eq("list_id", id).order("position"),
  ]);
  if (error || itemsError) {
    return (
      <>
        <Header title="Your list" step={1} back="/" />
        <p className="note error">{explainDbError((error ?? itemsError)!.message)}</p>
      </>
    );
  }
  if (!list) notFound();

  return (
    <>
      <Header title="Check your list" step={1} back="/" />
      <p className="muted small">Change anything that's wrong. Your list saves automatically.</p>
      <ListEditor
        listId={list.id}
        initialCategory={list.category === "hardware" ? "hardware" : "grocery"}
        initialItems={(items ?? []).map((it) => ({ ...it, quantity: Number(it.quantity) }))}
      />
    </>
  );
}
