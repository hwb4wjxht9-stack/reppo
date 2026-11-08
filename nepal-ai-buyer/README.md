# Nepal AI Buyer — clickable prototype (build step 1)

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
