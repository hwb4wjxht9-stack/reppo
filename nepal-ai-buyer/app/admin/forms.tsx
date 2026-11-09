"use client";

import { useActionState, useRef } from "react";
import { addShopAction, bulkAddAction, loginAction, type FormState } from "./actions";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p className="note error">{state.error}</p>;
  if (state.ok) return <p className="note ok">✔ {state.ok}</p>;
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

export function AddShopForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await addShopAction(prev, form);
    if (res.ok) ref.current?.reset();
    return res;
  }, {});

  return (
    <form ref={ref} action={action} className="card form-grid">
      <strong>Add a shop</strong>
      <label>
        Shop name *
        <input name="name" className="input" required placeholder="Shrestha Kirana Pasal" />
      </label>
      <label>
        Phone *
        <input name="phone" className="input" required inputMode="tel" placeholder="9841234567 or 01-4123456" />
      </label>
      <div className="two">
        <label>
          Area *
          <input name="area" className="input" required placeholder="Baneshwor" />
        </label>
        <label>
          Category *
          <select name="category" className="input" defaultValue="grocery">
            <option value="grocery">Grocery</option>
            <option value="hardware">Hardware</option>
          </select>
        </label>
      </div>
      <label>
        Address / landmark
        <input name="address" className="input" placeholder="Near Shankhamul road" />
      </label>
      <label>
        Closing time
        <input name="closes_at" className="input" placeholder="8:30 PM" />
      </label>
      <label>
        Notes
        <input name="notes" className="input" placeholder="Owner: Ram dai, good for rice" />
      </label>
      <label className="check">
        <input type="checkbox" name="consent" /> Shop agreed to receive AI calls
      </label>
      <button className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Add shop"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function BulkAddForm() {
  const [state, action, pending] = useActionState(bulkAddAction, {});
  return (
    <details className="card">
      <summary>
        <strong>Paste many shops at once</strong>
      </summary>
      <form action={action} className="form-grid">
        <p className="muted small">
          One shop per line: <code>name, phone, area, category, closing time</code>. You can copy rows from a
          spreadsheet saved as CSV.
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
