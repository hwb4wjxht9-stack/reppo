import { adminPasswordSet, isAdmin } from "@/lib/server/admin-auth";
import { db, explainDbError, supabaseConfigured, supabaseSetupProblem } from "@/lib/server/supabase";
import { mapsLink } from "@/lib/location";
import { formatNepalPhone } from "@/lib/phone";
import { logoutAction, toggleShopAction } from "./actions";
import { BulkAddForm, DeleteButton, LoginForm, ShopForm, type Shop } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shops admin — Nepal AI Buyer" };

function Setup({ missing }: { missing: string[] }) {
  return (
    <div className="card">
      <strong>Almost there: connect the database</strong>
      <p className="small">
        These settings are missing from <code>.env.local</code>: <code>{missing.join(", ")}</code>.
      </p>
      <p className="small">Follow “Step 2” in the README, then restart <code>npm run dev</code>.</p>
    </div>
  );
}

function Toggle({ id, field, value, on, off }: { id: string; field: string; value: boolean; on: string; off: string }) {
  return (
    <form action={toggleShopAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <button className={`pill ${value ? "pill-on" : ""}`}>{value ? on : off}</button>
    </form>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !adminPasswordSet() && "ADMIN_PASSWORD (8+ characters)",
  ].filter(Boolean) as string[];

  const header = (
    <header className="header">
      <div className="header-row">
        <span className="logo">मोलमोलाइ</span>
        <h1>Shops</h1>
      </div>
    </header>
  );

  if (missing.length || !supabaseConfigured()) {
    return (
      <>
        {header}
        <Setup missing={missing} />
      </>
    );
  }

  const problem = supabaseSetupProblem();
  if (problem) {
    return (
      <>
        {header}
        <div className="card">
          <strong>Check your .env.local file</strong>
          <p className="note error">{problem}</p>
          <p className="small">Fix it, save the file, then stop the app (Ctrl + C) and run npm run dev again.</p>
        </div>
      </>
    );
  }

  if (!(await isAdmin())) {
    return (
      <>
        {header}
        <LoginForm />
      </>
    );
  }

  const { cat, q } = await searchParams;
  const { data, error } = await db().from("shops").select("*").order("area").order("name");
  const all = (data ?? []) as Shop[];
  const ready = all.filter((s) => s.active && s.consent).length;
  const needle = (q ?? "").trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const shops = all.filter(
    (s) =>
      (cat !== "grocery" && cat !== "hardware" ? true : s.category === cat) &&
      (!needle ||
        s.name.toLowerCase().includes(needle) ||
        s.area.toLowerCase().includes(needle) ||
        (s.address ?? "").toLowerCase().includes(needle) ||
        (digits.length >= 3 && s.phone.includes(digits))),
  );
  const withLocation = all.filter((s) => s.lat != null).length;
  const qs = (c: string) => {
    const p = new URLSearchParams();
    if (c) p.set("cat", c);
    if (q) p.set("q", q);
    const str = p.toString();
    return str ? `/admin?${str}` : "/admin";
  };

  return (
    <>
      {header}
      {error && <p className="note error">{explainDbError(error.message)}</p>}

      <div className="progress-card">
        <strong>
          {all.length} {all.length === 1 ? "shop" : "shops"} · {ready} ready to call · {withLocation} on the map
        </strong>
        <span className="muted small">“Ready” = active and the shop agreed to AI calls.</span>
      </div>

      <ShopForm />
      <BulkAddForm />

      <form className="search" action="/admin">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" className="input" defaultValue={q} placeholder="Search name, area or phone" aria-label="Search shops" />
      </form>

      <nav className="tabs">
        {[
          ["", "All"],
          ["grocery", "Grocery"],
          ["hardware", "Hardware"],
        ].map(([v, label]) => (
          <a key={v} href={qs(v)} className={(cat ?? "") === v ? "on" : ""}>
            {label}
          </a>
        ))}
      </nav>

      <ul className="shop-list">
        {all.length === 0 && <li className="muted">No shops yet. Add your first one above.</li>}
        {all.length > 0 && shops.length === 0 && <li className="muted">No shops match.</li>}
        {shops.map((s) => (
          <li key={s.id} className={`card shop ${s.active ? "" : "inactive"}`}>
            <div className="row">
              <strong>{s.name}</strong>
              <span className="muted small">{s.category}</span>
            </div>
            <div className="small">
              📍 {s.area}
              {s.address && ` · ${s.address}`} · 📞 <a href={`tel:${s.phone}`}>{formatNepalPhone(s.phone)}</a>
              {s.closes_at && ` · closes ${s.closes_at}`}
            </div>
            <div className="small">
              {s.lat != null && s.lng != null ? (
                <a href={mapsLink(s.lat, s.lng)} target="_blank" rel="noreferrer">
                  🗺 Open in Google Maps
                </a>
              ) : (
                <span className="muted">No map location yet</span>
              )}
            </div>
            {s.notes && <div className="muted small">{s.notes}</div>}
            <div className="shop-actions">
              <Toggle id={s.id} field="active" value={s.active} on="Active" off="Paused" />
              <Toggle id={s.id} field="consent" value={s.consent} on="Agreed to AI calls" off="No consent yet" />
              <div className="push">
                <DeleteButton id={s.id} name={s.name} />
              </div>
            </div>
            <details className="edit">
              <summary className="link small">✏️ Edit</summary>
              <ShopForm shop={s} />
            </details>
          </li>
        ))}
      </ul>

      <form action={logoutAction}>
        <button className="link small">Log out</button>
      </form>
    </>
  );
}
