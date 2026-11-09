# Nepal AI Buyer

- **Step 1 (done):** clickable prototype of the six customer screens, fake data.
- **Step 2 (done):** real shops database + `/admin` page to add Kathmandu shops.

## Step 1 — the prototype

A tap-through prototype of the six screens: Home → Confirm list → Choose mode →
Calls → Best offers → Pickup. **All shops, prices and calls are fake** (see
`lib/data.ts`). Nothing costs money, deploys, or makes real phone calls.

## Run it on your computer

You need Node.js 20 or newer (https://nodejs.org).

```bash
cd nepal-ai-buyer
npm install        # first time only
npm run dev
```

Open http://localhost:3000 on your computer. To try it on your phone, open
`http://<your-computer's-IP>:3000` on the same Wi-Fi.
Tip: in Chrome's DevTools, the phone icon shows it at phone size.

## Where things are

| File | What it is |
| --- | --- |
| `app/page.tsx` | Home: photo / upload / type a list, popular searches |
| `app/list/page.tsx` | Confirm list: edit names, quantities, add or remove |
| `app/mode/page.tsx` | Automatic / Supervised / Manual |
| `app/calls/page.tsx` | Live call status, transcripts, Listen Live, Take Over (fast-forwarded) |
| `app/offers/page.tsx` | All / Cheapest / Best Quality, price per item, split across shops |
| `app/pickup/page.tsx` | Pickup address and closing time, fee, savings, shop rating |
| `lib/data.ts` | The fake shops, prices and Nepali transcript |
| `lib/offers.ts` | Works out totals (always the whole list) and savings |

## Changes from the mockup that are already built in

- No "Delivery: Free". The app shows the pickup address and closing time instead.
- Every total covers the whole list. If a shop lacks an item, that item comes from the next cheapest shop and the offer shows as a split.
- Shows the savings and fee line ("Saved Rs. X · Our fee Rs. 50").
- Shop ratings are our own from pickups ("New shop, not rated yet" until then), with no review counts.
- Every call transcript opens with the AI saying it's an AI assistant calling for a customer.

## Step 2 — connect the real shops database (Supabase, free tier)

You do this once. About 15 minutes. Nothing here costs money on the free plan.

1. Go to https://supabase.com, sign up, and click **New project**.
   - Name: `nepal-ai-buyer`. Region: **Mumbai** (closest to Nepal).
   - Choose a strong database password and save it in your password manager.
2. When the project is ready, open **SQL Editor → New query**. Open the file
   `supabase/schema.sql` from this folder, copy all of it, paste it in, and click **Run**.
   You should see "Success. No rows returned".
3. Open **Project Settings → API** (may be called **API Keys**) and copy:
   - the **Project URL**
   - the **service_role** / **secret** key (click "Reveal"). Treat this like a bank password.
4. In the `nepal-ai-buyer` folder, copy `.env.example` to a new file named `.env.local`
   and fill it in:
   ```
   SUPABASE_URL=<Project URL>
   SUPABASE_SERVICE_ROLE_KEY=<secret key>
   ADMIN_PASSWORD=<any long password you make up>
   ```
   `.env.local` is never uploaded to GitHub.
5. Restart the app (`Ctrl+C`, then `npm run dev`) and open http://localhost:3000/admin.
   Log in with your `ADMIN_PASSWORD`.

### Adding shops

- **One at a time:** fill in the form. Phone numbers can be typed any way
  (`9841234567`, `984-123-4567`, `01-4123456`); they're saved as `+977…`, which the calling service needs.
- **Many at once:** open "Paste many shops at once" and paste one shop per line:
  `name, phone, area, category, closing time` (category is `grocery` or `hardware`).
- **"Agreed to AI calls":** only tick this after the shop owner has said yes. When we
  turn on real calls, **the AI will only call shops that are Active and have agreed.**
- **Paused:** stops calling a shop without losing it. Delete only works for shops
  that haven't been called yet (otherwise it pauses them instead).

Aim for 10–20 shops in one area (e.g. Baneshwor or Kalimati) for the first tests.
