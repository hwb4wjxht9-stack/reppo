import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { PATHS } from "../constants.js";
import { assetCodeSchema, cursorSchema, limitSchema } from "../schemas/common.js";
import { request } from "../services/client.js";
import {
  ResponseFormat,
  buildListOutput,
  listOutputSchema,
  recordSchema,
  renderRecord,
  renderRecordList,
  responseFormatSchema,
  toolResponse,
  type JsonRecord,
} from "../services/format.js";
import { runTool } from "../services/handler.js";

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "robinhood_get_crypto_account",
    {
      title: "Get Robinhood Crypto Account",
      description: `Get the authenticated user's Robinhood **crypto** account details, including account number, status, and crypto buying power.

This is the starting point for any trading workflow: it confirms the credentials work and reports how much buying power is available before placing orders. It covers crypto only — Robinhood has no public API for stocks or options.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  The account object as Robinhood returns it, typically:
  {
    "account_number": string,          // e.g. "1234567890"
    "status": string,                  // e.g. "active"
    "buying_power": string,            // decimal string, e.g. "1000.00"
    "buying_power_currency": string    // e.g. "USD"
  }

Examples:
  - Use when: "How much crypto buying power do I have?"
  - Use when: "Are my Robinhood API credentials working?"
  - Don't use when: You need position sizes (use robinhood_list_crypto_holdings instead)

Error Handling:
  - Returns a credentials error for HTTP 401/403 — check the API key, private key, credential scopes, and system clock
  - Returns a rate-limit error for HTTP 429`,
      inputSchema: { response_format: responseFormatSchema },
      outputSchema: { account: recordSchema.describe("Account object from Robinhood") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) =>
      runTool(async () => {
        const account = await request<JsonRecord>({ path: PATHS.account });
        return toolResponse(
          { account },
          renderRecord("Robinhood Crypto Account", account),
          response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_list_crypto_holdings",
    {
      title: "List Robinhood Crypto Holdings",
      description: `List the authenticated user's crypto holdings (positions), optionally filtered to specific asset codes.

Reports how much of each asset is held and how much is available to trade, which is what you need before sizing a sell order.

Args:
  - asset_codes (string[]): Optional asset codes to filter by, e.g. ["BTC", "ETH"]. Omit for all holdings.
  - limit (number): Maximum items to return, 1-100 (default: 20)
  - cursor (string): Pagination cursor from a previous response's 'next_cursor'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,          // Items in this response
    "items": [                // Holding objects as Robinhood returns them
      {
        "account_number": string,
        "asset_code": string,                    // e.g. "BTC"
        "total_quantity": number,                // e.g. 0.0125
        "quantity_available_for_trading": number
      }
    ],
    "has_more": boolean,      // Whether another page exists
    "next_cursor": string     // Present when has_more is true
  }

Examples:
  - Use when: "What crypto do I hold?" -> no filter
  - Use when: "How much BTC can I sell right now?" -> asset_codes=["BTC"]
  - Don't use when: You want dollar buying power (use robinhood_get_crypto_account instead)

Error Handling:
  - Returns "No results." when the account holds none of the requested assets
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: {
        asset_codes: assetCodeSchema
          .array()
          .max(50)
          .optional()
          .describe("Optional asset codes to filter by, e.g. ['BTC','ETH']"),
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
    async ({ asset_codes, limit, cursor, response_format }) =>
      runTool(async () => {
        const data = await request<{ results?: JsonRecord[]; next?: string | null }>({
          path: PATHS.holdings,
          query: { asset_code: asset_codes, limit, cursor },
        });
        const output = buildListOutput(data.results ?? [], data.next, limit);
        return toolResponse(
          output,
          renderRecordList(
            "Crypto Holdings",
            output.items as JsonRecord[],
            "asset_code",
            output,
          ),
          response_format as ResponseFormat,
        );
      }),
  );
}
