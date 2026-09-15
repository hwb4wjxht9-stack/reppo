import { z } from "zod";

import { RobinhoodApiError } from "./client.js";
import { errorResponse, type ToolResponse } from "./format.js";

/** Converts thrown errors into tool-level error results so the agent can recover. */
export async function runTool(work: () => Promise<ToolResponse>): Promise<ToolResponse> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RobinhoodApiError) return errorResponse(`Error: ${error.message}`);
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return errorResponse(`Error: invalid arguments. ${issues}`);
    }
    return errorResponse(
      `Error: unexpected failure: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
