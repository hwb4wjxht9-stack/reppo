import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PATHS } from "../constants.js";
import {
  cursorSchema,
  decimalStringSchema,
  limitSchema,
  orderSideSchema,
  symbolSchema,
} from "../schemas/common.js";
import { request } from "../services/client.js";
import {
  ResponseFormat,
  buildListOutput,
  listOutputSchema,
  recordSchema,
  renderRecordList,
  responseFormatSchema,
  toolResponse,
  type JsonRecord,
} from "../services/format.js";
import { runTool } from "../services/handler.js";

export function registerMarketTools(server: McpServer): void {
  server.registerTool(
    "robinhood_list_crypto_trading_pairs",
    {
      title: "List Robinhood Crypto Trading Pairs",
      description: `List the crypto trading pairs supported by Robinhood, with the order-size and increment limits that apply to each.

Call this before placing an order to learn the minimum/maximum order size and the quantity/price increments a pair accepts — orders that violate them are rejected.

Args:
  - symbols (string[]): Optional pair symbols to filter by, e.g. ["BTC-USD", "ETH-USD"]. Omit for all pairs.
  - limit (number): Maximum items to return, 1-100 (default: 20)
  - cursor (string): Pagination cursor from a previous response's 'next_cursor'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,
    "items": [                       // Trading pair objects as Robinhood returns them
      {
        "symbol": string,            // e.g. "BTC-USD"
        "asset_code": string,        // e.g. "BTC"
        "quote_code": string,        // e.g. "USD"
        "asset_increment": string,   // smallest tradable quantity step, e.g. "0.000001"
        "quote_increment": string,   // smallest price step, e.g. "0.01"
        "min_order_size": string,
        "max_order_size": string,
        "status": string             // e.g. "tradable"
      }
    ],
    "has_more": boolean,
    "next_cursor": string
  }

Examples:
  - Use when: "Which coins can I trade on Robinhood?" -> no filter
  - Use when: "What's the minimum BTC order size?" -> symbols=["BTC-USD"]
  - Don't use when: You need live prices (use robinhood_get_crypto_quote instead)

Error Handling:
  - Returns "No results." if none of the requested symbols exist
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: {
        symbols: symbolSchema
          .array()
          .max(50)
          .optional()
          .describe("Optional pair symbols to filter by, e.g. ['BTC-USD']"),
        limit: limitSchema,
        cursor: cursorSchema,
        response_format: responseFormatSchema,
      },
      outputSchema: listOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ symbols, limit, cursor, response_format }) =>
      runTool(async () => {
        const data = await request<{ results?: JsonRecord[]; next?: string | null }>({
          path: PATHS.tradingPairs,
          query: { symbol: symbols, limit, cursor },
        });
        const output = buildListOutput(data.results ?? [], data.next, limit);
        return toolResponse(
          output,
          renderRecordList("Crypto Trading Pairs", output.items as JsonRecord[], "symbol", output),
          response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_get_crypto_quote",
    {
      title: "Get Robinhood Crypto Best Bid/Ask",
      description: `Get the current best bid and ask for one or more crypto trading pairs, including Robinhood's buy/sell spreads.

Use this for the live price of a pair. The spread-inclusive fields are what a trade would actually execute near; 'price' is the mid-market reference.

Args:
  - symbols (string[]): One or more pair symbols, e.g. ["BTC-USD", "ETH-USD"] (1-50 symbols)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,
    "quotes": [                                 // Quote objects as Robinhood returns them
      {
        "symbol": string,                       // e.g. "BTC-USD"
        "price": number,                        // mid-market reference price
        "bid_inclusive_of_sell_spread": number, // effective price when selling
        "sell_spread": number,
        "ask_inclusive_of_buy_spread": number,  // effective price when buying
        "buy_spread": number,
        "timestamp": string                     // ISO 8601
      }
    ]
  }

Examples:
  - Use when: "What's the price of Bitcoin right now?" -> symbols=["BTC-USD"]
  - Use when: "Compare BTC and ETH prices" -> symbols=["BTC-USD","ETH-USD"]
  - Don't use when: You need the fill price for a specific size (use robinhood_get_crypto_estimated_price)

Error Handling:
  - Returns "No results." for symbols Robinhood does not quote
  - Returns a rate-limit error for HTTP 429 — batch symbols into one call rather than looping`,
      inputSchema: {
        symbols: symbolSchema
          .array()
          .min(1, "Provide at least one symbol")
          .max(50)
          .describe("Pair symbols to quote, e.g. ['BTC-USD','ETH-USD']"),
        response_format: responseFormatSchema,
      },
      outputSchema: {
        count: z.number().describe("Number of quotes returned"),
        quotes: z.array(recordSchema).describe("Quotes as returned by Robinhood"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ symbols, response_format }) =>
      runTool(async () => {
        const data = await request<{ results?: JsonRecord[] }>({
          path: PATHS.bestBidAsk,
          query: { symbol: symbols },
        });
        const quotes = data.results ?? [];
        const output: JsonRecord = { count: quotes.length, quotes };
        return toolResponse(
          output,
          renderRecordList("Crypto Quotes", quotes, "symbol", {}),
          response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_get_crypto_estimated_price",
    {
      title: "Get Robinhood Crypto Estimated Fill Price",
      description: `Get Robinhood's estimated execution price for a specific pair, side, and one or more order quantities.

Unlike a best bid/ask quote, this accounts for the size of the trade, so it is the right tool for "what would it cost me to buy X of Y" and for checking price impact across sizes before placing an order.

Args:
  - symbol (string): Pair symbol, e.g. "BTC-USD"
  - side ('buy' | 'sell'): Side to estimate
  - quantities (string[]): One or more asset quantities as decimal strings, e.g. ["0.001", "0.01"] (1-10 values)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,
    "estimates": [                              // Estimate objects as Robinhood returns them
      {
        "symbol": string,
        "side": string,
        "quantity": number,
        "price": number,                        // estimated price for this quantity
        "bid_inclusive_of_sell_spread": number,
        "ask_inclusive_of_buy_spread": number,
        "timestamp": string
      }
    ]
  }

Examples:
  - Use when: "What would 0.5 ETH cost me?" -> symbol="ETH-USD", side="buy", quantities=["0.5"]
  - Use when: "Compare price impact at three sizes" -> quantities=["0.1","1","10"]
  - Don't use when: You just want the current market price (use robinhood_get_crypto_quote)

Error Handling:
  - Returns an error naming the constraint if a quantity violates the pair's limits — check robinhood_list_crypto_trading_pairs
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: {
        symbol: symbolSchema,
        side: orderSideSchema,
        quantities: decimalStringSchema
          .array()
          .min(1, "Provide at least one quantity")
          .max(10)
          .describe("Asset quantities as decimal strings, e.g. ['0.001','0.01']"),
        response_format: responseFormatSchema,
      },
      outputSchema: {
        count: z.number().describe("Number of estimates returned"),
        estimates: z.array(recordSchema).describe("Estimates as returned by Robinhood"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ symbol, side, quantities, response_format }) =>
      runTool(async () => {
        const data = await request<{ results?: JsonRecord[] }>({
          path: PATHS.estimatedPrice,
          // Robinhood expects a single comma-separated 'quantity' value.
          query: { symbol, side, quantity: quantities.join(",") },
        });
        const estimates = data.results ?? [];
        const output: JsonRecord = { count: estimates.length, estimates };
        return toolResponse(
          output,
          renderRecordList(
            `Estimated ${side} price for ${symbol}`,
            estimates,
            "quantity",
            {},
          ),
          response_format as ResponseFormat,
        );
      }),
  );
}
