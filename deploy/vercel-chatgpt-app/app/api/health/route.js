import { mutationsEnabled } from "../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "akashic-chatgpt-gateway",
    version: "0.7.0",
    workflow_authority: "temporal",
    control_configured: Boolean(
      process.env.AKASHIC_CONTROL_URL || process.env.AKASHIC_RUNNER_URL,
    ),
    mutations_enabled: mutationsEnabled(),
  });
}
