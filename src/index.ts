#!/usr/bin/env node
/**
 * MCP server for the official Robinhood Crypto Trading API (trading.robinhood.com).
 *
 * Covers crypto only: Robinhood publishes no supported API for stocks or options.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { RobinhoodApiError, loadCredentials } from "./services/client.js";
import { registerAccountTools } from "./tools/account.js";
import { registerMarketTools } from "./tools/market.js";
import { registerOrderTools } from "./tools/orders.js";

function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAccountTools(server);
  registerMarketTools(server);
  registerOrderTools(server);
  return server;
}

async function runStdio(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error(`${SERVER_NAME} ${SERVER_VERSION} running on stdio`);
}

async function runHttp(): Promise<void> {
  const app = express();
  app.use(express.json());

  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const allowedHosts = (process.env.ALLOWED_HOSTS ?? `${host}:${port},localhost:${port}`)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");

  app.post("/mcp", async (req, res) => {
    // A fresh stateless transport per request keeps concurrent request IDs from colliding.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts,
    });
    res.on("close", () => void transport.close());
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, host, () => {
    console.error(`${SERVER_NAME} ${SERVER_VERSION} running on http://${host}:${port}/mcp`);
  });
}

async function main(): Promise<void> {
  // Fail fast with an actionable message rather than on the first tool call.
  loadCredentials();

  const transport = process.env.TRANSPORT ?? "stdio";
  if (transport === "http") {
    await runHttp();
  } else if (transport === "stdio") {
    await runStdio();
  } else {
    throw new Error(`Unknown TRANSPORT '${transport}'. Use 'stdio' or 'http'.`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof RobinhoodApiError) {
    console.error(`Startup failed: ${error.message}`);
  } else {
    console.error(`Startup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});
