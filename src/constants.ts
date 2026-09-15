export const DEFAULT_BASE_URL = "https://trading.robinhood.com";

export const SERVER_NAME = "robinhood-crypto-mcp-server";
export const SERVER_VERSION = "1.0.0";

export const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum characters returned in a single tool response before truncation. */
export const CHARACTER_LIMIT = 25_000;

export const PATHS = {
  account: "/api/v1/crypto/trading/accounts/",
  holdings: "/api/v1/crypto/trading/holdings/",
  tradingPairs: "/api/v1/crypto/trading/trading_pairs/",
  orders: "/api/v1/crypto/trading/orders/",
  bestBidAsk: "/api/v1/crypto/marketdata/best_bid_ask/",
  estimatedPrice: "/api/v1/crypto/marketdata/estimated_price/",
} as const;

export const orderPath = (orderId: string): string => `${PATHS.orders}${orderId}/`;
export const cancelOrderPath = (orderId: string): string => `${PATHS.orders}${orderId}/cancel/`;
