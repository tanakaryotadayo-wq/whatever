import {
  authorizeCodexModeRead,
  loadCodexModeStatus,
} from "../../../../lib/codex-mode-gpt-actions.js";
import { errorResponse } from "../../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  try {
    authorizeCodexModeRead(request);
    const result = await loadCodexModeStatus();
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
