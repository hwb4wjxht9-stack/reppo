"use client";

// Shown instead of a crash if anything on the admin page goes wrong.
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card">
      <strong>The admin page hit a problem</strong>
      <p className="note error">{error.message || "Unknown error"}</p>
      <p className="small">
        In Terminal, press <code>Ctrl + C</code>, then run <code>npm run doctor</code>. It checks your settings and tells you
        exactly what to fix. Then start again with <code>npm run dev</code>.
      </p>
      <button className="btn secondary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
