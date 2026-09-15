import { randomUUID } from "node:crypto";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PATHS, cancelOrderPath, orderPath } from "../constants.js";
import {
  cursorSchema,
  decimalStringSchema,
  limitSchema,
  orderIdSchema,
  orderSideSchema,
  orderStateSchema,
  orderTypeSchema,
  symbolSchema,
} from "../schemas/common.js";
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

type OrderType = z.infer<typeof orderTypeSchema>;

interface OrderConfigInput {
  asset_quantity?: string;
  quote_amount?: string;
  limit_price?: string;
  stop_price?: string;
  time_in_force: "gtc" | "ioc" | "fok";
}

/**
 * Builds the `{type}_order_config` payload, rejecting combinations Robinhood
 * would reject so the failure surfaces before an order is sent.
 */
function buildOrderConfig(
  type: OrderType,
  input: OrderConfigInput,
): { key: string; config: JsonRecord } {
  const hasQuantity = input.asset_quantity !== undefined;
  const hasQuoteAmount = input.quote_amount !== undefined;

  if (hasQuantity === hasQuoteAmount) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["asset_quantity"],
        message:
          "Provide exactly one of 'asset_quantity' (amount of crypto) or 'quote_amount' (amount of USD)",
      },
    ]);
  }

  const config: JsonRecord = {};
  if (input.asset_quantity !== undefined) config.asset_quantity = input.asset_quantity;
  if (input.quote_amount !== undefined) config.quote_amount = input.quote_amount;

  const needsLimitPrice = type === "limit" || type === "stop_limit";
  const needsStopPrice = type === "stop_loss" || type === "stop_limit";

  if (needsLimitPrice) {
    if (input.limit_price === undefined) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["limit_price"],
          message: `'limit_price' is required for ${type} orders`,
        },
      ]);
    }
    config.limit_price = input.limit_price;
  } else if (input.limit_price !== undefined) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["limit_price"],
        message: `'limit_price' is not valid for ${type} orders`,
      },
    ]);
  }

  if (needsStopPrice) {
    if (input.stop_price === undefined) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["stop_price"],
          message: `'stop_price' is required for ${type} orders`,
        },
      ]);
    }
    config.stop_price = input.stop_price;
  } else if (input.stop_price !== undefined) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["stop_price"],
        message: `'stop_price' is not valid for ${type} orders`,
      },
    ]);
  }

  if (type !== "market") config.time_in_force = input.time_in_force;

  return { key: `${type}_order_config`, config };
}

export function registerOrderTools(server: McpServer): void {
  server.registerTool(
    "robinhood_list_crypto_orders",
    {
      title: "List Robinhood Crypto Orders",
      description: `List the authenticated user's crypto orders, newest first, with optional filters.

Use this to review order history, find open orders to cancel, or check whether a recent order filled.

Args:
  - symbol (string): Optional pair symbol filter, e.g. "BTC-USD"
  - side ('buy' | 'sell'): Optional side filter
  - state ('open' | 'canceled' | 'partially_filled' | 'filled' | 'failed'): Optional state filter
  - type ('market' | 'limit' | 'stop_loss' | 'stop_limit'): Optional order type filter
  - limit (number): Maximum items to return, 1-100 (default: 20)
  - cursor (string): Pagination cursor from a previous response's 'next_cursor'
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,
    "items": [                            // Order objects as Robinhood returns them
      {
        "id": string,                     // order UUID
        "client_order_id": string,
        "symbol": string,
        "side": string,
        "type": string,
        "state": string,                  // e.g. "filled"
        "average_price": number | null,
        "filled_asset_quantity": number,
        "created_at": string,             // ISO 8601
        "updated_at": string,
        "executions": [{ "effective_price": string, "quantity": string, "timestamp": string }]
      }
    ],
    "has_more": boolean,
    "next_cursor": string
  }

Examples:
  - Use when: "Do I have any open orders?" -> state="open"
  - Use when: "Show my last 5 BTC trades" -> symbol="BTC-USD", limit=5
  - Don't use when: You know the order ID (use robinhood_get_crypto_order)

Error Handling:
  - Returns "No results." when no orders match the filters
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: {
        symbol: symbolSchema.optional().describe("Optional pair symbol filter, e.g. 'BTC-USD'"),
        side: orderSideSchema.optional().describe("Optional side filter"),
        state: orderStateSchema.optional().describe("Optional state filter"),
        type: orderTypeSchema.optional().describe("Optional order type filter"),
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
    async ({ symbol, side, state, type, limit, cursor, response_format }) =>
      runTool(async () => {
        const data = await request<{ results?: JsonRecord[]; next?: string | null }>({
          path: PATHS.orders,
          query: { symbol, side, state, type, limit, cursor },
        });
        const output = buildListOutput(data.results ?? [], data.next, limit);
        return toolResponse(
          output,
          renderRecordList("Crypto Orders", output.items as JsonRecord[], "id", output),
          response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_get_crypto_order",
    {
      title: "Get Robinhood Crypto Order",
      description: `Get a single crypto order by its Robinhood order ID, including its current state and executions.

Use this to confirm the outcome of an order you placed, or to inspect fills and the average execution price.

Args:
  - order_id (string): Robinhood order ID (UUID), as returned by robinhood_place_crypto_order or robinhood_list_crypto_orders
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "order": {
      "id": string,
      "client_order_id": string,
      "symbol": string,
      "side": string,
      "type": string,
      "state": string,
      "average_price": number | null,
      "filled_asset_quantity": number,
      "created_at": string,
      "updated_at": string,
      "executions": [{ "effective_price": string, "quantity": string, "timestamp": string }]
    }
  }

Examples:
  - Use when: "Did my order fill?" -> order_id from the place-order response
  - Use when: "What price did order <id> execute at?"
  - Don't use when: You need to search orders (use robinhood_list_crypto_orders)

Error Handling:
  - Returns a not-found error for HTTP 404 — verify the order ID belongs to this account
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: { order_id: orderIdSchema, response_format: responseFormatSchema },
      outputSchema: { order: recordSchema.describe("Order object from Robinhood") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id, response_format }) =>
      runTool(async () => {
        const order = await request<JsonRecord>({ path: orderPath(order_id) });
        return toolResponse(
          { order },
          renderRecord(`Crypto Order ${order_id}`, order),
          response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_place_crypto_order",
    {
      title: "Place Robinhood Crypto Order",
      description: `Place a REAL crypto order on the authenticated user's Robinhood account, spending or selling real money.

This is irreversible once filled. It defaults to a preview: without 'confirm: true' the tool validates the request and returns the exact payload it would send WITHOUT placing anything. Set 'confirm: true' only when the user has approved this specific order, including side, symbol, size, and price.

Check 'robinhood_get_crypto_account' for buying power, 'robinhood_list_crypto_trading_pairs' for size/increment limits, and 'robinhood_get_crypto_estimated_price' for the likely fill price before confirming.

Args:
  - symbol (string): Pair symbol, e.g. "BTC-USD"
  - side ('buy' | 'sell'): Order side
  - type ('market' | 'limit' | 'stop_loss' | 'stop_limit'): Order type
  - asset_quantity (string): Amount of crypto as a decimal string, e.g. "0.001". Provide this OR quote_amount, not both.
  - quote_amount (string): Amount of quote currency (USD) as a decimal string, e.g. "25.00". Provide this OR asset_quantity, not both.
  - limit_price (string): Required for 'limit' and 'stop_limit'; rejected otherwise
  - stop_price (string): Required for 'stop_loss' and 'stop_limit'; rejected otherwise
  - time_in_force ('gtc' | 'ioc' | 'fok'): Applies to non-market orders (default: 'gtc')
  - client_order_id (string): Optional idempotency UUID; generated automatically when omitted, so retrying with the same value will not double-fill
  - confirm (boolean): Must be true to actually place the order (default: false = preview only)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Preview (confirm=false):
  {
    "placed": false,
    "preview": { ... },        // exact request body that would be sent
    "message": string          // how to confirm
  }
  Placed (confirm=true):
  {
    "placed": true,
    "order": {                 // order object as Robinhood returns it
      "id": string,            // order UUID — pass to robinhood_get_crypto_order
      "client_order_id": string,
      "symbol": string,
      "side": string,
      "type": string,
      "state": string,
      "created_at": string
    }
  }

Examples:
  - Use when: user approved "buy $25 of BTC at market" -> symbol="BTC-USD", side="buy", type="market", quote_amount="25.00", confirm=true
  - Use when: user asked to preview a limit sell -> type="limit", side="sell", asset_quantity="0.01", limit_price="70000.00" (leave confirm=false)
  - Don't use when: The user has not specified size and price — preview first and ask

Error Handling:
  - Returns an argument error when required price/quantity fields for the order type are missing or conflicting
  - Returns Robinhood's own message for rejected orders (e.g. insufficient buying power, size below minimum)
  - Returns a credentials error for HTTP 401/403 — a credential without trading scope cannot place orders`,
      inputSchema: {
        symbol: symbolSchema,
        side: orderSideSchema,
        type: orderTypeSchema,
        asset_quantity: decimalStringSchema
          .optional()
          .describe("Amount of crypto as a decimal string, e.g. '0.001'"),
        quote_amount: decimalStringSchema
          .optional()
          .describe("Amount of USD as a decimal string, e.g. '25.00'"),
        limit_price: decimalStringSchema
          .optional()
          .describe("Limit price; required for 'limit' and 'stop_limit'"),
        stop_price: decimalStringSchema
          .optional()
          .describe("Stop trigger price; required for 'stop_loss' and 'stop_limit'"),
        time_in_force: z
          .enum(["gtc", "ioc", "fok"])
          .default("gtc")
          .describe("Time in force for non-market orders (default: 'gtc')"),
        client_order_id: z
          .string()
          .uuid("client_order_id must be a UUID")
          .optional()
          .describe("Optional idempotency UUID; generated when omitted"),
        confirm: z
          .boolean()
          .default(false)
          .describe("Must be true to actually place the order; false returns a preview only"),
        response_format: responseFormatSchema,
      },
      outputSchema: {
        placed: z.boolean().describe("Whether an order was actually submitted"),
        preview: recordSchema.optional().describe("Request body that would be sent"),
        order: recordSchema.optional().describe("Order object returned by Robinhood"),
        message: z.string().optional().describe("Next-step guidance for previews"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) =>
      runTool(async () => {
        const { key, config } = buildOrderConfig(params.type, {
          asset_quantity: params.asset_quantity,
          quote_amount: params.quote_amount,
          limit_price: params.limit_price,
          stop_price: params.stop_price,
          time_in_force: params.time_in_force,
        });

        const body: JsonRecord = {
          client_order_id: params.client_order_id ?? randomUUID(),
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          [key]: config,
        };

        if (!params.confirm) {
          const output: JsonRecord = {
            placed: false,
            preview: body,
            message:
              "Preview only — nothing was submitted. Re-call with confirm: true (reusing this client_order_id) once the user has approved this exact order.",
          };
          const markdown = [
            `# Order preview (NOT placed)`,
            "",
            `**${params.side.toUpperCase()} ${params.symbol}** as a ${params.type} order`,
            "",
            "```json",
            JSON.stringify(body, null, 2),
            "```",
            "",
            "Nothing was submitted. Re-call with `confirm: true` (reusing this `client_order_id`) once the user has approved this exact order.",
          ].join("\n");
          return toolResponse(output, markdown, params.response_format as ResponseFormat);
        }

        const order = await request<JsonRecord>({
          path: PATHS.orders,
          method: "POST",
          body,
        });
        return toolResponse(
          { placed: true, order },
          renderRecord("Crypto Order Placed", order),
          params.response_format as ResponseFormat,
        );
      }),
  );

  server.registerTool(
    "robinhood_cancel_crypto_order",
    {
      title: "Cancel Robinhood Crypto Order",
      description: `Request cancellation of an open crypto order on the authenticated user's Robinhood account.

Cancellation is best-effort: an order that has already filled cannot be canceled, and a partially filled order keeps the portion already executed. Confirm the result with robinhood_get_crypto_order.

Args:
  - order_id (string): Robinhood order ID (UUID) of the open order to cancel
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "order_id": string,
    "cancel_requested": true,
    "response": { ... }        // Robinhood's cancellation response body, when it returns one
  }

Examples:
  - Use when: user asked to cancel a resting limit order -> order_id from robinhood_list_crypto_orders with state="open"
  - Use when: "Cancel my open BTC order" -> look it up first, then cancel by ID
  - Don't use when: The order already shows state "filled" — it cannot be canceled

Error Handling:
  - Returns a not-found error for HTTP 404 — verify the order ID belongs to this account
  - Returns Robinhood's own message when the order is no longer cancelable
  - Returns a credentials error for HTTP 401/403`,
      inputSchema: { order_id: orderIdSchema, response_format: responseFormatSchema },
      outputSchema: {
        order_id: z.string().describe("Order ID the cancellation was requested for"),
        cancel_requested: z.boolean().describe("Whether Robinhood accepted the cancel request"),
        response: recordSchema.optional().describe("Cancellation response body, if any"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id, response_format }) =>
      runTool(async () => {
        const response = await request<unknown>({
          path: cancelOrderPath(order_id),
          method: "POST",
        });
        const output: JsonRecord = { order_id, cancel_requested: true };
        if (response !== null && typeof response === "object") {
          output.response = response as JsonRecord;
        }
        const markdown = [
          `# Cancellation requested for order ${order_id}`,
          "",
          "Robinhood accepted the cancel request. Cancellation is best-effort — call `robinhood_get_crypto_order` to confirm the final state.",
        ].join("\n");
        return toolResponse(output, markdown, response_format as ResponseFormat);
      }),
  );
}
