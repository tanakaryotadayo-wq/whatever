import { applyContextDeltaToVercelWorkflow } from "../../../../../../lib/vercel-workflow-backend.js";
import {
  errorResponse,
  requireAuthorizedMutation,
} from "../../../../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request, context) {
  try {
    requireAuthorizedMutation(request);
    const { runId } = await context.params;
    const body = await request.json();
    const result = await applyContextDeltaToVercelWorkflow(
      runId,
      body?.context_delta ?? body,
    );
    return Response.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
