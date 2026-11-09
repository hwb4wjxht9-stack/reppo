"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { formatNepalPhone } from "@/lib/phone";
import { bulkAddAction, deleteShopAction, loginAction, saveShopAction, type FormState } from "./actions";

export type Shop = {
  id: string;
  name: string;
  phone: string;
  area: string;
  category: "grocery" | "hardware";
  address: string | null;
  closes_at: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  consent: boolean;
  notes: string | null;
};

/**
 * React clears a form after every submit, even when the server says there's a
 * mistake. Submitting this way keeps what the person typed, so they only fix
 * the mistake. Forms that should clear on success do it themselves.
 */
function keepInputs(dispatch: (form: FormData) => void, confirmText?: string) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmText && !confirm(confirmText)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}

function Message({ state }: { state: FormState }) {
  if (state.error) return <p className="note error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="note ok" role="status">✔ {state.ok}</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="card">
      <label className="label" htmlFor="pw">
        Admin password
      </label>
      <input id="pw" name="password" type="password" className="input" autoComplete="current-password" required />
      <button className="btn primary" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </button>
      <Message state={state} />
    </form>
  );
}

function LocationField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState("");

  function useHere() {
    if (!navigator.geolocation) return setStatus("This browser can't share your location.");
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setStatus(`Got it (accurate to about ${Math.round(pos.coords.accuracy)} m).`);
      },
      () => setStatus("Couldn't get your location. Allow location access, or paste it instead."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <label>
      Map location
      <input
        name="location"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="27.7172, 85.3240 or a Google Maps link"
      />
      <span className="loc-row">
        <button type="button" className="link small" onClick={useHere}>
          📍 Use where I am now
        </button>
        {status && <span className="muted small">{status}</span>}
      </span>
    </label>
  );
}

/** Add form when `shop` is missing, edit form when it's given. */
export function ShopForm({ shop }: { shop?: Shop }) {
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await saveShopAction(prev, form);
    if (res.ok && !shop) setFormKey((k) => k + 1); // fresh, empty form after adding
    return res;
  }, {});
  const editing = Boolean(shop);
  const loc = shop?.lat != null && shop?.lng != null ? `${shop.lat}, ${shop.lng}` : "";

  return (
    <form onSubmit={keepInputs(action)} className={editing ? "form-grid" : "card form-grid"} key={formKey}>
      {!editing && <strong>Add a shop</strong>}
      {shop && <input type="hidden" name="id" value={shop.id} />}
      <label>
        Shop name *
        <input name="name" className="input" required maxLength={100} defaultValue={shop?.name} placeholder="Shrestha Kirana Pasal" />
      </label>
      <label>
        Phone *
        <input
          name="phone"
          className="input"
          required
          inputMode="tel"
          defaultValue={shop ? formatNepalPhone(shop.phone) : undefined}
          placeholder="9841234567 or 01-4123456"
        />
      </label>
      <div className="two">
        <label>
          Area *
          <input name="area" className="input" required maxLength={60} defaultValue={shop?.area} placeholder="Baneshwor" />
        </label>
        <label>
          Category *
          <select name="category" className="input" defaultValue={shop?.category ?? "grocery"}>
            <option value="grocery">Grocery</option>
            <option value="hardware">Hardware</option>
          </select>
        </label>
      </div>
      <label>
        Address / landmark
        <input
          name="address"
          className="input"
          maxLength={200}
          defaultValue={shop?.address ?? ""}
          placeholder="Near Shankhamul road"
        />
      </label>
      <LocationField initial={loc} />
      <label>
        Closing time
        <input name="closes_at" className="input" maxLength={30} defaultValue={shop?.closes_at ?? ""} placeholder="8:30 PM" />
      </label>
      <label>
        Notes
        <input name="notes" className="input" maxLength={300} defaultValue={shop?.notes ?? ""} placeholder="Owner: Ram dai" />
      </label>
      <label className="check">
        <input type="checkbox" name="consent" defaultChecked={shop?.consent} /> Shop agreed to receive AI calls
      </label>
      <button className="btn primary" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save changes" : "Add shop"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteShopAction, {});
  return (
    <form onSubmit={keepInputs(action, `Delete ${name}? This can't be undone.`)}>
      <input type="hidden" name="id" value={id} />
      <button className="link small danger-text" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function BulkAddForm() {
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await bulkAddAction(prev, form);
    if (res.ok) setFormKey((k) => k + 1);
    return res;
  }, {});
  return (
    <details className="card">
      <summary>
        <strong>Paste many shops at once</strong>
      </summary>
      <form key={formKey} onSubmit={keepInputs(action)} className="form-grid">
        <p className="muted small">
          One shop per line: <code>name, phone, area, category, closing time</code>. Add map locations afterwards with
          Edit.
        </p>
        <textarea
          name="bulk"
          rows={6}
          placeholder={"Shrestha Kirana Pasal, 9841234567, Baneshwor, grocery, 8:30 PM\nMonika Hardware, 01-4123456, Kalimati, hardware"}
        />
        <button className="btn primary" disabled={pending}>
          {pending ? "Saving…" : "Add all"}
        </button>
        <Message state={state} />
      </form>
    </details>
  );
}
