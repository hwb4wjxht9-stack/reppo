import { adminPasswordSet, isAdmin } from "@/lib/server/admin-auth";
import { db, explainDbError, supabaseConfigured, supabaseSetupProblem } from "@/lib/server/supabase";
import { formatNepalPhone } from "@/lib/phone";
import { deleteShopAction, logoutAction, toggleShopAction } from "./actions";
import { AddShopForm, BulkAddForm, LoginForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shops admin — Nepal AI Buyer" };

type ShopRow = {
  id: string;
  name: string;
  phone: string;
  area: string;
  category: string;
  closes_at: string | null;
  active: boolean;
  consent: boolean;
  notes: string | null;
};

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

export default async function Admin({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
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

  const { cat } = await searchParams;
  let query = db().from("shops").select("*").order("area").order("name");
  if (cat === "grocery" || cat === "hardware") query = query.eq("category", cat);
  const { data, error } = await query;
  const shops = (data ?? []) as ShopRow[];
  const ready = shops.filter((s) => s.active && s.consent).length;

  return (
    <>
      {header}
      {error && (
        <p className="note error">
          {explainDbError(error.message)}
        </p>
      )}

      <div className="progress-card">
        <strong>
          {shops.length} {shops.length === 1 ? "shop" : "shops"} · {ready} ready to call
        </strong>
        <span className="muted small">“Ready” = active and the shop agreed to AI calls.</span>
      </div>

      <AddShopForm />
      <BulkAddForm />

      <nav className="tabs">
        {[
          ["", "All"],
          ["grocery", "Grocery"],
          ["hardware", "Hardware"],
        ].map(([v, label]) => (
          <a key={v} href={v ? `/admin?cat=${v}` : "/admin"} className={(cat ?? "") === v ? "on" : ""}>
            {label}
          </a>
        ))}
      </nav>

      <ul className="shop-list">
        {shops.length === 0 && <li className="muted">No shops yet. Add your first one above.</li>}
        {shops.map((s) => (
          <li key={s.id} className={`card shop ${s.active ? "" : "inactive"}`}>
            <div className="row">
              <strong>{s.name}</strong>
              <span className="muted small">{s.category}</span>
            </div>
            <div className="small">
              📍 {s.area} · 📞 <a href={`tel:${s.phone}`}>{formatNepalPhone(s.phone)}</a>
              {s.closes_at && ` · closes ${s.closes_at}`}
            </div>
            {s.notes && <div className="muted small">{s.notes}</div>}
            <div className="shop-actions">
              <Toggle id={s.id} field="active" value={s.active} on="Active" off="Paused" />
              <Toggle id={s.id} field="consent" value={s.consent} on="Agreed to AI calls" off="No consent yet" />
              <form action={deleteShopAction} className="push">
                <input type="hidden" name="id" value={s.id} />
                <button className="link small danger-text">Delete</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <form action={logoutAction}>
        <button className="link small">Log out</button>
      </form>
    </>
  );
}
