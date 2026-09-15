import { z } from "zod";

export const symbolSchema = z
  .string()
  .regex(/^[A-Z0-9]{1,15}-[A-Z]{2,10}$/, "Symbol must look like 'BTC-USD' (uppercase asset-quote)")
  .describe("Trading pair symbol, e.g. 'BTC-USD'");

export const assetCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{1,15}$/, "Asset code must be uppercase, e.g. 'BTC'")
  .describe("Crypto asset code, e.g. 'BTC'");

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Maximum items to return, 1-100 (default: 20)");

export const cursorSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Pagination cursor from a previous response's 'next_cursor'");

export const orderIdSchema = z
  .string()
  .uuid("Order ID must be a UUID as returned by Robinhood")
  .describe("Robinhood order ID (UUID)");

export const orderSideSchema = z.enum(["buy", "sell"]).describe("Order side: 'buy' or 'sell'");

export const orderTypeSchema = z
  .enum(["market", "limit", "stop_loss", "stop_limit"])
  .describe("Order type: 'market', 'limit', 'stop_loss', or 'stop_limit'");

export const orderStateSchema = z
  .enum(["open", "canceled", "partially_filled", "filled", "failed"])
  .describe("Order state filter");

/** Decimal strings avoid the float rounding that would silently change an order size. */
export const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal string, e.g. '0.001'");
