import Link from "next/link";

const STEPS = ["Home", "List", "Mode", "Calls", "Offers", "Pickup"];

export default function Header({ title, step, back }: { title: string; step: number; back?: string }) {
  return (
    <header className="header">
      <div className="header-row">
        {back ? (
          <Link href={back} className="back" aria-label="Back">
            ←
          </Link>
        ) : (
          <span className="logo">मोलमोलाइ</span>
        )}
        <h1>{title}</h1>
      </div>
      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "done" : i === step ? "now" : ""} title={s} />
        ))}
      </ol>
    </header>
  );
}
