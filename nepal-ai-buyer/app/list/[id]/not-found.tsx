import Link from "next/link";
import Header from "@/components/Header";

export default function ListNotFound() {
  return (
    <>
      <Header title="List not found" step={1} back="/" />
      <p className="muted">This list doesn't exist (or the link is wrong).</p>
      <Link href="/" className="btn primary">
        Start a new list
      </Link>
    </>
  );
}
