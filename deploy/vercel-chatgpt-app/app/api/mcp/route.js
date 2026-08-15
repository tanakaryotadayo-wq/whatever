import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  controlUrl,
  mutationsEnabled,
  requireMutation,
  sanitize,
} from "../../../lib/gateway-utils.js";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const METHODS = new Set(["tasks/send", "tasks/get", "tasks/update", "tasks/cancel"]);
const JsonObject = z.record(z.string(), z.unknown());

function success(data, text = "Akashic operation completed.") {
  return {
    structuredContent: data,
    content: [{ type: "text", text }],
  };
}

function failure(error) {
  const code = typeof error?.code === "string" ? error.code : "akashic_error";
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    structuredContent: { ok: false, error: { code, message } },
    content: [{ type: "text", text: `${code}: ${message}` }],
  };
}

async function rpc(method, params) {
  if (!METHODS.has(method)) {
    throw Object.assign(new Error("unsupported control method"), {
      code: "unsupported_method",
    });
  }
  const base = controlUrl();
  const url = new URL(`${base.pathname}/a2a`.replace(/\/{2,}/g, "/"), base);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const headers = { "content-type": "application/json" };
  const token = process.env.AKASHIC_CONTROL_TOKEN ?? process.env.AKASHIC_RUNNER_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(url, {
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
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      throw Object.assign(
        new Error(payload?.error?.message || `control HTTP ${response.status}`),
        { code: "control_rpc_error" },
      );
    }
    return sanitize(payload.result ?? payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("control service timeout"), {
        code: "control_timeout",
      });
    }
    throw error;
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
        "Inspect the v0.7 ChatGPT gateway and Temporal control service before dispatching durable work.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        let control = null;
        if (process.env.AKASHIC_CONTROL_URL || process.env.AKASHIC_RUNNER_URL) {
          const base = controlUrl();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          const response = await fetch(
            new URL(`${base.pathname}/healthz`.replace(/\/{2,}/g, "/"), base),
            {
              cache: "no-store",
              redirect: "error",
              signal: controller.signal,
            },
          ).finally(() => clearTimeout(timer));
          control = sanitize(
            await response.json().catch(() => ({ status: response.status })),
          );
        }
        return success(
          {
            ok: true,
            gateway: {
              platform: "vercel",
              version: "0.7.0",
              mutations_enabled: mutationsEnabled(),
            },
            control,
          },
          "Akashic status loaded.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "akashic_deployment_plan",
    {
      title: "Akashic deployment plan",
      description: "Return the canonical v0.7 authority split.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () =>
      success(
        {
          operator: "ChatGPT Project and private MCP/App surface",
          gateway: "Vercel MCP ingress",
          workflow_authority: "Temporal",
          source_authority: "GitHub",
          artifact_authority: "Google Drive or R2",
          execution: "Codex, Claude, or local Activity workers",
          cloudflare: "optional edge/R2/conformance experiment; never concurrent task authority",
        },
        "Canonical deployment plan loaded.",
      ),
  );

  server.registerTool(
    "akashic_submit_task",
    {
      title: "Submit Akashic task",
      description:
        "Start or idempotently reuse a durable RunAgentTask workflow from a bounded TaskCapsuleV1.",
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
        return success(await rpc("tasks/send", { task }), "Task submitted.");
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "akashic_get_task",
    {
      title: "Get Akashic task",
      description:
        "Read the compact Temporal-owned task snapshot, including INPUT_REQUIRED and artifact references.",
      inputSchema: z.object({
        task_id: z.string().min(1).max(160),
        since_seq: z.number().int().min(0).optional(),
        wait_ms: z.number().int().min(0).max(30_000).default(0),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ task_id, since_seq, wait_ms }) => {
      try {
        return success(
          await rpc("tasks/get", {
            id: task_id,
            ...(since_seq === undefined ? {} : { since_seq }),
            wait_ms,
            view: "compact",
          }),
          "Task state loaded.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "akashic_apply_context_delta",
    {
      title: "Apply context delta",
      description:
        "Apply a CAS-guarded ContextPacketDeltaRefV1 to an INPUT_REQUIRED workflow through a Temporal Update.",
      inputSchema: z.object({
        task_id: z.string().min(1).max(160),
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
        return success(
          await rpc("tasks/update", { id: task_id, context_delta }),
          "Context delta applied.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "akashic_cancel_task",
    {
      title: "Cancel Akashic task",
      description: "Durably cancel a nonterminal workflow and its active Activity scope.",
      inputSchema: z.object({ task_id: z.string().min(1).max(160) }),
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
        return success(
          await rpc("tasks/cancel", { id: task_id }),
          "Cancellation requested.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );
});

export { handler as GET, handler as POST };
