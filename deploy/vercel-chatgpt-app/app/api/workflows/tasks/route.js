import { startVercelWorkflow } from "../../../../lib/vercel-workflow-backend.js";
import {
  errorResponse,
  requireAuthorizedMutation,
} from "../../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  try {
    requireAuthorizedMutation(request);
    const body = await request.json();
    const result = await startVercelWorkflow(body?.task ?? body);
    return Response.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
