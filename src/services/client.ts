import axios, { AxiosError } from "axios";
import nacl from "tweetnacl";

import { DEFAULT_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";
import type { RobinhoodCredentials } from "../types.js";

export type HttpMethod = "GET" | "POST";

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

/** Thrown for any failed Robinhood API interaction, carrying the upstream detail. */
export class RobinhoodApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = "RobinhoodApiError";
  }
}

let cachedCredentials: RobinhoodCredentials | undefined;

export function loadCredentials(): RobinhoodCredentials {
  if (cachedCredentials) return cachedCredentials;

  const apiKey = process.env.ROBINHOOD_API_KEY;
  const privateKeyBase64 = process.env.ROBINHOOD_PRIVATE_KEY;

  if (!apiKey) {
    throw new RobinhoodApiError(
      "Missing ROBINHOOD_API_KEY. Create API credentials in Robinhood web (crypto account settings -> API keys) and set ROBINHOOD_API_KEY.",
    );
  }
  if (!privateKeyBase64) {
    throw new RobinhoodApiError(
      "Missing ROBINHOOD_PRIVATE_KEY. Set it to the base64-encoded Ed25519 private key whose public key is registered with your Robinhood API credential (run `npm run keygen` to create a key pair).",
    );
  }

  cachedCredentials = {
    apiKey,
    privateKeyBase64,
    baseUrl: process.env.ROBINHOOD_BASE_URL ?? DEFAULT_BASE_URL,
  };
  return cachedCredentials;
}

/**
 * Robinhood registers the 32-byte Ed25519 seed; tweetnacl signs with the
 * 64-byte expanded secret key, so a seed is expanded and a full key passes through.
 */
function toSecretKey(privateKeyBase64: string): Uint8Array {
  let decoded: Buffer;
  try {
    decoded = Buffer.from(privateKeyBase64, "base64");
  } catch {
    throw new RobinhoodApiError("ROBINHOOD_PRIVATE_KEY is not valid base64.");
  }

  if (decoded.length === nacl.sign.seedLength) {
    return nacl.sign.keyPair.fromSeed(new Uint8Array(decoded)).secretKey;
  }
  if (decoded.length === nacl.sign.secretKeyLength) {
    return new Uint8Array(decoded);
  }
  throw new RobinhoodApiError(
    `ROBINHOOD_PRIVATE_KEY decodes to ${decoded.length} bytes; expected ${nacl.sign.seedLength} (seed) or ${nacl.sign.secretKeyLength} (expanded secret key).`,
  );
}

export function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * Signs `apiKey + timestamp + path + method + body` with Ed25519, where `path`
 * includes the query string exactly as sent and `body` is the exact serialized bytes.
 */
export function signRequest(
  credentials: RobinhoodCredentials,
  path: string,
  method: HttpMethod,
  body: string,
): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${credentials.apiKey}${timestamp}${path}${method}${body}`;
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    toSecretKey(credentials.privateKeyBase64),
  );
  return { signature: Buffer.from(signature).toString("base64"), timestamp };
}

export async function request<T>(options: {
  path: string;
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: unknown;
}): Promise<T> {
  const { path, method = "GET", query, body } = options;
  const credentials = loadCredentials();

  const fullPath = `${path}${buildQueryString(query)}`;
  const serializedBody = body === undefined ? "" : JSON.stringify(body);
  const { signature, timestamp } = signRequest(credentials, fullPath, method, serializedBody);

  try {
    const response = await axios({
      method,
      url: `${credentials.baseUrl}${fullPath}`,
      data: method === "POST" ? serializedBody : undefined,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "x-api-key": credentials.apiKey,
        "x-timestamp": String(timestamp),
        "x-signature": signature,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Send the exact signed bytes; re-serialization would invalidate the signature.
      transformRequest: [(data: unknown) => data],
    });
    return response.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

function toApiError(error: unknown): RobinhoodApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const detail = describeBody(axiosError.response?.data);

    if (status === 401 || status === 403) {
      return new RobinhoodApiError(
        `Robinhood rejected the credentials (HTTP ${status}). Verify ROBINHOOD_API_KEY, that ROBINHOOD_PRIVATE_KEY matches the registered public key, that the credential has the required scopes, and that the host clock is accurate (signatures expire after 30 seconds).${detail}`,
        status,
        axiosError.response?.data,
      );
    }
    if (status === 404) {
      return new RobinhoodApiError(
        `Not found (HTTP 404). Check the order ID or symbol.${detail}`,
        status,
        axiosError.response?.data,
      );
    }
    if (status === 429) {
      return new RobinhoodApiError(
        `Rate limit exceeded (HTTP 429). Wait before retrying and batch symbols into a single call where possible.${detail}`,
        status,
        axiosError.response?.data,
      );
    }
    if (status) {
      return new RobinhoodApiError(
        `Robinhood API request failed with HTTP ${status}.${detail}`,
        status,
        axiosError.response?.data,
      );
    }
    if (axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT") {
      return new RobinhoodApiError("Request to Robinhood timed out. Retry the call.");
    }
    return new RobinhoodApiError(`Could not reach Robinhood: ${axiosError.message}`);
  }
  if (error instanceof RobinhoodApiError) return error;
  return new RobinhoodApiError(error instanceof Error ? error.message : String(error));
}

function describeBody(data: unknown): string {
  if (data === undefined || data === null || data === "") return "";
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return ` Robinhood said: ${text.slice(0, 1_000)}`;
}
