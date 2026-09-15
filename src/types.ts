export interface RobinhoodCredentials {
  apiKey: string;
  /** Base64-encoded 32-byte Ed25519 seed. */
  privateKeyBase64: string;
  baseUrl: string;
}

export interface CursorPage<T> {
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface CryptoAccount {
  account_number: string;
  status: string;
  buying_power: string;
  buying_power_currency: string;
}

export interface Holding {
  account_number: string;
  asset_code: string;
  total_quantity: number;
  quantity_available_for_trading: number;
}

export interface TradingPair {
  asset_code: string;
  quote_code: string;
  quote_increment: string;
  asset_increment: string;
  max_order_size: string;
  min_order_size: string;
  status: string;
  symbol: string;
}

export interface BidAskQuote {
  symbol: string;
  price: number;
  bid_inclusive_of_sell_spread: number;
  sell_spread: number;
  ask_inclusive_of_buy_spread: number;
  buy_spread: number;
  timestamp: string;
}

export interface EstimatedPriceQuote {
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  bid_inclusive_of_sell_spread: number;
  sell_spread: number;
  ask_inclusive_of_buy_spread: number;
  buy_spread: number;
  timestamp: string;
}

export interface Order {
  id: string;
  account_number: string;
  symbol: string;
  client_order_id: string;
  side: string;
  executions: OrderExecution[];
  type: string;
  state: string;
  average_price?: number | null;
  filled_asset_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface OrderExecution {
  effective_price: string;
  quantity: string;
  timestamp: string;
}

/** Cursor-paginated list envelope returned by the marketdata quote endpoints. */
export interface QuoteList<T> {
  results: T[];
}
