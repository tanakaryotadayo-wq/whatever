import { getVercelWorkflow } from "../../../../../lib/vercel-workflow-backend.js";
import {
  errorResponse,
  verifyGatewayRequest,
} from "../../../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request, context) {
  try {
    if (!verifyGatewayRequest(request)) {
      return Response.json(
        { ok: false, error: { code: "unauthorized", message: "unauthorized" } },
        { status: 401 },
      );
    }
    const { runId } = await context.params;
    const result = await getVercelWorkflow(runId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
