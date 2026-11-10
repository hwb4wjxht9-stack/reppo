# Nepal AI Buyer

| Step | What | Status |
| --- | --- | --- |
| 1 | Clickable prototype of the six customer screens | done (calls, offers and pickup still use fake data) |
| 2 | Shops dashboard at `/admin`: add, edit, delete shops with map location | done, saved in Supabase |
| 3 | Shopping list: type a list → editable items (name, quantity, unit) | done, saved in Supabase. Photo upload later |
| 4 | First real AI call (Vapi) | next — needs your OK before anything costs money |

Nothing in this app costs money, uses a paid API key, or makes real phone calls yet.

## Start the app (every time)

In Terminal, inside the `nepal-ai-buyer` folder:

```bash
npm run dev
```

Then open **http://localhost:3000** (customers) or **http://localhost:3000/admin** (your shops).

`npm run dev` does the clean-up for you each time: it stops any old copy of the app
still running on port 3000, clears the temporary `.next` folder, checks your settings,
and starts the app on port 3000.

- **Stop the app with `Ctrl + C`.** Not `Ctrl + Z`: that only freezes it, and the page then hangs.
- Something wrong? Stop the app and run **`npm run doctor`**. It checks Node, packages, the port,
  your `.env.local` file and the database, and tells you exactly what to fix.
- First time only: run `npm install` before `npm run dev`.

## Step 2 — connect the database (Supabase, free tier), once

1. At https://supabase.com create a project: name `nepal-ai-buyer`, region **Mumbai**, free plan.
2. Supabase → **SQL Editor → New query**: paste all of `supabase/schema.sql`, click **Run**.
   (Run it again whenever this README says the schema changed. It's safe to re-run.
   **Step 3 added two columns, so run it once more now.**)
3. Supabase → **Project Settings → Data API / API Keys**: copy the **Project URL** and the
   **service_role / secret** key.
4. In this folder:
   ```bash
   cp .env.example .env.local
   open -e .env.local
   ```
   Fill in (no quotes, no spaces):
   ```
   SUPABASE_URL=https://abcdxyz.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=the-long-secret-key
   ADMIN_PASSWORD=any-password-8-or-more-characters
   ```
   `.env.local` is never uploaded to GitHub. Don't share the secret key.
5. `npm run doctor` should end with **All good!** Then `npm run dev`.

## Using the shops dashboard (`/admin`)

- **Add a shop:** name, phone (type it any way: `9841234567`, `984-123-4567`, `01-4123456`),
  area, grocery or hardware, address, closing time.
- **Map location:** paste coordinates (`27.7172, 85.3240`) or a full Google Maps link, or tap
  **Use where I am now** while standing in the shop. In Google Maps on your phone,
  press and hold on the shop to see its coordinates. Short `maps.app.goo.gl` links can't be read.
- **Edit:** tap ✏️ Edit on any shop. **Delete** asks first; a shop with call history is paused instead.
- **Agreed to AI calls:** tick only after the owner says yes. The AI will only call shops that
  are Active **and** agreed.
- **Paste many shops at once:** one per line: `name, phone, area, category, closing time`.
- **Search** by name, area or phone.

## The shopping list

Customers type their list on the home page, one item per line, in English or Nepali:

```
25 kg rice            rice 25kg          चामल २५ किलो
2 litre mustard oil   eggs 2 dozen       आधा किलो जिरा
cement 2 bora         soap x3            sugar
```

The app turns it into items with a name, quantity and unit. A missing unit is guessed
(rice → kg, oil → litre, eggs → dozen), and the same item written twice is added together.
On the next screen everything can be edited, removed or added to, and it **saves automatically**.
It also picks grocery or hardware, which decides which shops get called.

Each list has its own link (`/list/…`). There are no customer accounts yet, so anyone with
the link can open that list.

## Getting a newer version of the code

1. Stop the app (`Ctrl + C`).
2. Rename your current folder so the new download doesn't clash:
   ```bash
   cd ~/Downloads && mv reppo-claude-happy-thompson-qp19od app-old
   ```
3. Download the new ZIP and double-click it. Then copy your settings across and start:
   ```bash
   cp ~/Downloads/app-old/nepal-ai-buyer/.env.local ~/Downloads/reppo-claude-happy-thompson-qp19od/nepal-ai-buyer/
   cd ~/Downloads/reppo-claude-happy-thompson-qp19od/nepal-ai-buyer
   npm install
   npm run dev
   ```

## Where things are

| File | What it is |
| --- | --- |
| `app/page.tsx` | Home: type your list |
| `app/list/[id]/page.tsx`, `components/ListEditor.tsx` | Edit a saved list |
| `app/list/actions.ts` | Saving lists to the database |
| `lib/parseList.ts` | Reads typed lists (tested in `tests/parsers.test.ts`, run `npm test`) |
| `app/admin/` | Shops dashboard |
| `lib/location.ts`, `lib/phone.ts` | Reading map locations and Nepali phone numbers |
| `app/mode`, `app/calls`, `app/offers`, `app/pickup` | Prototype screens (fake calls and prices) |
| `supabase/schema.sql` | Database tables |
| `scripts/dev.mjs`, `scripts/doctor.mjs` | `npm run dev` and `npm run doctor` |
