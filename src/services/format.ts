import { z } from "zod";

import { CHARACTER_LIMIT } from "../constants.js";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const responseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export type JsonRecord = Record<string, unknown>;

/** Robinhood owns the response shape, so records pass through unvalidated. */
export const recordSchema = z.record(z.unknown());

export const listOutputSchema = {
  count: z.number().describe("Number of items in this response"),
  items: z.array(recordSchema).describe("Items as returned by Robinhood, unmodified"),
  has_more: z.boolean().describe("Whether another page is available"),
  next_cursor: z
    .string()
    .optional()
    .describe("Cursor to pass as the 'cursor' argument to fetch the next page"),
  truncated: z.boolean().optional().describe("True when items were dropped to fit the size limit"),
  truncation_message: z.string().optional().describe("Explains how to retrieve the omitted items"),
};

export interface ToolResponse {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent: JsonRecord;
  isError?: boolean;
}

export function toolResponse(
  structured: JsonRecord,
  markdown: string,
  format: ResponseFormat,
): ToolResponse {
  const text =
    format === ResponseFormat.JSON ? JSON.stringify(structured, null, 2) : markdown;
  return {
    content: [{ type: "text", text: enforceCharacterLimit(text) }],
    structuredContent: structured,
  };
}

export function errorResponse(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: message },
    isError: true,
  };
}

function enforceCharacterLimit(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return `${text.slice(0, CHARACTER_LIMIT)}\n\n[Response truncated at ${CHARACTER_LIMIT} characters. Narrow the request with filters, a smaller 'limit', or pagination.]`;
}

/** Extracts the opaque cursor Robinhood embeds in its `next` page URL. */
export function extractCursor(nextUrl: unknown): string | undefined {
  if (typeof nextUrl !== "string" || nextUrl === "") return undefined;
  try {
    return new URL(nextUrl).searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

export function buildListOutput(
  items: JsonRecord[],
  nextUrl: unknown,
  maxItems: number,
): JsonRecord {
  const nextCursor = extractCursor(nextUrl);
  const kept = items.slice(0, maxItems);
  const output: JsonRecord = {
    count: kept.length,
    items: kept,
    has_more: nextCursor !== undefined || kept.length < items.length,
  };
  if (nextCursor !== undefined) output.next_cursor = nextCursor;
  if (kept.length < items.length) {
    output.truncated = true;
    output.truncation_message = `Showing ${kept.length} of ${items.length} returned items. Raise 'limit' or paginate with 'cursor' to see the rest.`;
  }
  return output;
}

export function renderRecordList(
  title: string,
  items: JsonRecord[],
  titleField: string,
  output: JsonRecord,
): string {
  const lines = [`# ${title}`, ""];
  if (items.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  lines.push(`Showing ${items.length} item(s).`, "");
  for (const item of items) {
    const heading = item[titleField];
    lines.push(`## ${heading === undefined ? "(item)" : String(heading)}`);
    for (const [key, value] of Object.entries(item)) {
      if (key === titleField) continue;
      lines.push(`- **${key}**: ${renderValue(value)}`);
    }
    lines.push("");
  }
  if (output.next_cursor) {
    lines.push(`More results available. Next cursor: \`${String(output.next_cursor)}\``);
  }
  if (output.truncation_message) lines.push(String(output.truncation_message));
  return lines.join("\n");
}

export function renderRecord(title: string, item: JsonRecord): string {
  const lines = [`# ${title}`, ""];
  for (const [key, value] of Object.entries(item)) {
    lines.push(`- **${key}**: ${renderValue(value)}`);
  }
  return lines.join("\n");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}
