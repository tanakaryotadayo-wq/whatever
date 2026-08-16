import {
  gatewayAuthMode,
  mutations,
} from "../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "akashic-chatgpt-gateway",
    version: "0.9.0",
    mcp: "/api/mcp",
    workflow: {
      adapter: "vercel-workflow",
      sdk: "workflow@4.6.0",
      contract: "RunAgentTask",
      start: "/api/workflows/tasks",
    },
    runner_configured: Boolean(process.env.AKASHIC_RUNNER_URL),
    auth_mode: gatewayAuthMode(),
    mutations_enabled: mutations(),
  });
}
