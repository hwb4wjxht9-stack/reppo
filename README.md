# robinhood-crypto-mcp-server

An MCP server for the **official Robinhood Crypto Trading API** (`https://trading.robinhood.com`).

## Scope and limitations

- **Crypto only.** Robinhood publishes no supported public API for stocks or options; their Terms of Service prohibit automated access to those. The Crypto Trading API is their only documented public developer offering, so this server covers exactly that surface.
- **Real money.** These tools act on a live brokerage account. `robinhood_place_crypto_order` submits real orders and defaults to preview mode for that reason (see [Safety model](#safety-model)).
- **You need a Robinhood Crypto account** and API credentials created in web classic under crypto account settings → API keys.

## Tools

| Tool | Read-only | Purpose |
| --- | --- | --- |
| `robinhood_get_crypto_account` | yes | Account number, status, crypto buying power |
| `robinhood_list_crypto_holdings` | yes | Positions and quantity available to trade |
| `robinhood_list_crypto_trading_pairs` | yes | Supported pairs with size/increment limits |
| `robinhood_get_crypto_quote` | yes | Best bid/ask plus buy/sell spreads |
| `robinhood_get_crypto_estimated_price` | yes | Estimated fill price for specific sizes |
| `robinhood_list_crypto_orders` | yes | Order history with filters and pagination |
| `robinhood_get_crypto_order` | yes | One order by ID, including executions |
| `robinhood_place_crypto_order` | **no** | Place market/limit/stop_loss/stop_limit orders |
| `robinhood_cancel_crypto_order` | **no** | Request cancellation of an open order |

Every tool takes `response_format` (`markdown` default, or `json`) and returns `structuredContent` alongside the text. List tools take `limit` and a `cursor` from the previous response's `next_cursor`.

## Setup

```bash
npm install
npm run build
```

Generate an Ed25519 key pair, register the **public** key with Robinhood when creating the API credential, and keep the private key local:

```bash
npm run keygen
```

Then set the environment (see `.env.example`):

```bash
export ROBINHOOD_API_KEY="your-api-key"
export ROBINHOOD_PRIVATE_KEY="base64-ed25519-private-key"
```

### Run

```bash
npm start                 # stdio (default)
TRANSPORT=http npm start  # streamable HTTP on http://127.0.0.1:3000/mcp
```

### Register with Claude Code

```bash
claude mcp add robinhood-crypto --env ROBINHOOD_API_KEY=... --env ROBINHOOD_PRIVATE_KEY=... -- node /absolute/path/to/dist/index.js
```

## Safety model

Placing an order is irreversible once filled, so `robinhood_place_crypto_order`:

1. **Previews by default.** Without `confirm: true` it validates arguments, builds the exact request body, and returns it without contacting Robinhood. Nothing is submitted.
2. **Requires an explicit confirm.** `confirm: true` should only be set for an order the user approved by side, symbol, size, and price.
3. **Is idempotent on retry.** A `client_order_id` UUID is generated when omitted and echoed in the preview, so re-calling with the same value cannot double-fill.
4. **Rejects invalid combinations locally** — conflicting `asset_quantity`/`quote_amount`, a `limit_price` on a market order, a missing `stop_price` on a stop order — before any money moves.

Both mutating tools carry `destructiveHint: true`; all read tools carry `readOnlyHint: true`.

Grant the narrowest scopes the workflow needs when creating the Robinhood credential. A read-only credential cannot place orders no matter what the client asks for, which is the strongest guarantee available here — annotations are hints, not enforcement.

## Authentication

Each request is signed with Ed25519 over `api_key + timestamp + path + method + body`, sent as:

- `x-api-key` — the credential key
- `x-timestamp` — Unix **seconds** (Robinhood rejects signatures older than ~30 seconds, so the host clock must be accurate)
- `x-signature` — base64 detached Ed25519 signature

`path` includes the query string exactly as sent, and the signed body bytes are the exact bytes transmitted (`transformRequest` is disabled so axios cannot re-serialize them). `ROBINHOOD_PRIVATE_KEY` may be either the 32-byte seed or the 64-byte expanded secret key.

## Design notes

- **Strict inputs, pass-through outputs.** Inputs are validated with Zod (symbol format, decimal strings for quantities and prices, UUIDs for IDs). Responses are returned as Robinhood sends them — field names are never remapped, because silently renaming a price or quantity is worse than an unfamiliar field name. Output schemas are correspondingly permissive.
- **Decimal strings, not floats.** Quantities and prices are strings end to end so float rounding cannot change an order size.
- **Errors stay actionable.** HTTP 401/403 explains the four things that actually cause it (key, key pair mismatch, scopes, clock skew); 429 suggests batching symbols; rejected orders surface Robinhood's own message verbatim.
- **Pagination is cursor-based.** `next_cursor` is extracted from Robinhood's `next` URL so callers never construct URLs themselves.

## Verification status

Verified locally in this repo:

- `npm run build` compiles clean under `strict` TypeScript.
- Signing parity: the tweetnacl signature matches `node:crypto`'s native Ed25519 for the same message, for both seed and expanded key inputs.
- MCP handshake over stdio registers all 9 tools with input schemas, output schemas, and annotations.
- Preview mode returns the exact request body without any network call; conflicting or missing order fields are rejected before a request is built.

**Not verified:** live authenticated calls against `trading.robinhood.com`. That needs real credentials and network access to Robinhood, neither of which was available in the build environment. Before trusting this with size, run the read-only tools first (`robinhood_get_crypto_account`, then `robinhood_list_crypto_trading_pairs`), and place your first order at the pair's minimum size. If Robinhood rejects an order with a field-name error, check the current request schema in the official docs at `docs.robinhood.com/crypto/trading/` — the order-config field names here follow that spec but were not exercised live.
