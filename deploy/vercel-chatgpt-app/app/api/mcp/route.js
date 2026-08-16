import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  applyContextDeltaToVercelWorkflow,
  cancelVercelWorkflow,
  getVercelWorkflow,
  startVercelWorkflow,
} from "../../../lib/vercel-workflow-backend.js";
import {
  gatewayAuthMode,
  mutations,
  requireMutation,
  runnerUrl,
  sanitize,
  verifyGatewayRequest,
} from "../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const JsonObject = z.record(z.string(), z.unknown());

function ok(data, text = "Akashic operation completed.") {
  return {
    structuredContent: sanitize(data),
    content: [{ type: "text", text }],
  };
}

function failed(error) {
  const code = typeof error?.code === "string" ? error.code : "akashic_error";
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    structuredContent: {
      ok: false,
      error: { code, message, details: sanitize(error?.details ?? null) },
    },
    content: [{ type: "text", text: `${code}: ${message}` }],
  };
}

async function runnerRpc(method, params) {
  const base = runnerUrl();
  const endpoint = new URL(`${base.pathname}/a2a`.replace(/\/{2,}/g, "/"), base);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const headers = { "content-type": "application/json" };
    if (process.env.AKASHIC_RUNNER_TOKEN) {
      headers.authorization = `Bearer ${process.env.AKASHIC_RUNNER_TOKEN}`;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params,
      }),
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      throw Object.assign(
        new Error(
          payload?.error?.message ?? `runner returned HTTP ${response.status}`,
        ),
        {
          code: payload?.error?.data?.code ?? "runner_rpc_error",
          details: payload?.error?.data ?? null,
        },
      );
    }
    return sanitize(payload?.result ?? payload);
  } finally {
    clearTimeout(timer);
  }
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    "akashic_status",
    {
      title: "Akashic status",
      description:
        "Read the gateway, Vercel Workflow adapter, and optional external runner configuration.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () =>
      ok(
        {
          ok: true,
          gateway: {
            platform: "vercel",
            version: "0.9.0",
            auth_mode: gatewayAuthMode(),
            mutations_enabled: mutations(),
          },
          workflow: {
            adapter: "vercel-workflow",
            sdk: "workflow@4.6.0",
            contract: "RunAgentTask",
            routes: {
              start: "/api/workflows/tasks",
              get: "/api/workflows/tasks/{run_id}",
              context: "/api/workflows/tasks/{run_id}/context",
              cancel: "/api/workflows/tasks/{run_id}/cancel",
            },
          },
          external_runner_configured: Boolean(process.env.AKASHIC_RUNNER_URL),
        },
        "Akashic status loaded.",
      ),
  );

  server.registerTool(
    "akashic_start_workflow",
    {
      title: "Start Akashic workflow",
      description:
        "Start the Vercel Workflow RunAgentTask adapter. Returns a provider run_id while preserving task_id and logical_attempt_id.",
      inputSchema: z.object({ task: JsonObject }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ task }) => {
      try {
        requireMutation();
        return ok(await startVercelWorkflow(task), "Workflow submitted.");
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "akashic_get_workflow",
    {
      title: "Get Akashic workflow",
      description:
        "Read the latest compact Akashic task snapshot from a Vercel Workflow run.",
      inputSchema: z.object({ run_id: z.string().min(1).max(256) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ run_id }) => {
      try {
        return ok(await getVercelWorkflow(run_id), "Workflow loaded.");
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "akashic_apply_context_delta",
    {
      title: "Apply Akashic context delta",
      description:
        "Validate and resume an INPUT_REQUIRED Vercel Workflow using the exact Akashic CAS identities.",
      inputSchema: z.object({
        run_id: z.string().min(1).max(256),
        context_delta: JsonObject,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ run_id, context_delta }) => {
      try {
        requireMutation();
        return ok(
          await applyContextDeltaToVercelWorkflow(run_id, context_delta),
          "Context delta accepted.",
        );
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "akashic_cancel_workflow",
    {
      title: "Cancel Akashic workflow",
      description: "Request native Vercel Workflow run cancellation.",
      inputSchema: z.object({ run_id: z.string().min(1).max(256) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ run_id }) => {
      try {
        requireMutation();
        return ok(await cancelVercelWorkflow(run_id), "Cancellation requested.");
      } catch (error) {
        return failed(error);
      }
    },
  );

  // Legacy runner compatibility remains available while provider workers are external.
  server.registerTool(
    "submit_task",
    {
      title: "Submit task to external runner",
      description: "Submit one legacy Task Capsule to the configured HTTPS runner.",
      inputSchema: z.object({ task: JsonObject }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ task }) => {
      try {
        requireMutation();
        return ok(await runnerRpc("tasks/send", { task }), "Task submitted.");
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task from external runner",
      description: "Read compact legacy task state from the configured runner.",
      inputSchema: z.object({ task_id: z.string().min(1).max(256) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ task_id }) => {
      try {
        return ok(await runnerRpc("tasks/get", { id: task_id, view: "compact" }));
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "send_context",
    {
      title: "Send context to external runner",
      description: "Send a legacy ContextPacketDelta to the configured runner.",
      inputSchema: z.object({
        task_id: z.string().min(1).max(256),
        context_delta: JsonObject,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ task_id, context_delta }) => {
      try {
        requireMutation();
        return ok(
          await runnerRpc("tasks/update", {
            id: task_id,
            context_delta,
          }),
        );
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "cancel_task",
    {
      title: "Cancel task on external runner",
      description: "Cancel a legacy task on the configured runner.",
      inputSchema: z.object({ task_id: z.string().min(1).max(256) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ task_id }) => {
      try {
        requireMutation();
        return ok(await runnerRpc("tasks/cancel", { id: task_id }));
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    "akashic_deployment_plan",
    {
      title: "Akashic deployment plan",
      description: "Read the current authority split and evidence boundary.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () =>
      ok({
        source_authority: "GitHub main",
        ai_control_semantics:
          "Akashic routing/context/policy/effects/verification/adoption",
        temporal: "current reference implementation and high-control candidate",
        vercel_workflow:
          "bounded RunAgentTask adapter; native steps/hooks/cancellation/version retention",
        cloudflare: "third bake-off candidate; not a parallel task authority",
        drive_r2: "artifact/context/evidence/projection planes only",
        provider_workers:
          "Codex/Claude/local execution through replaceable Agent Activities or HTTPS runners",
        live_evidence_open: [
          "official Codex App Server same-thread two-turn",
          "real Drive credential/folder acceptance",
          "authenticated ChatGPT to Vercel mutation",
          "measured three-backend bake-off",
        ],
      }),
  );
});

async function guarded(request) {
  try {
    if (!verifyGatewayRequest(request)) {
      return Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "www-authenticate": "Bearer" } },
      );
    }
    return handler(request);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return Response.json(
      {
        error: {
          code: error?.code ?? "gateway_error",
          message: error instanceof Error ? error.message : String(error),
        },
      },
      { status },
    );
  }
}

export { guarded as GET, guarded as POST };
