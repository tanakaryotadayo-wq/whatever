import {
  NONTERMINAL,
  TERMINAL,
  appendEvent,
  canonicalJson,
  sha256Text,
  validateTask,
} from "./kernel-contract.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function bearerAuthorized(request, env) {
  if (!env.AKASHIC_CONTROL_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.AKASHIC_CONTROL_TOKEN}`;
}

function taskIdFromPath(pathname) {
  const match = pathname.match(/^\/v1\/tasks\/([^/]+)(?:\/(context|cancel|transition))?$/);
  if (!match) return null;
  return { taskId: decodeURIComponent(match[1]), action: match[2] ?? "get" };
}

async function bodyJson(request) {
  const text = await request.text();
  if (!text || text.length > 1_048_576) throw new Error("invalid request body size");
  const payload = JSON.parse(text);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("request body must be an object");
  }
  return payload;
}

export class TaskKernel {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async readSnapshot() {
    return (await this.ctx.storage.get("snapshot")) ?? null;
  }

  async writeSnapshot(snapshot) {
    await this.ctx.storage.put("snapshot", snapshot);
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/submit") {
        const { task } = await bodyJson(request);
        const normalized = validateTask(task);
        const executionHash = await sha256Text(canonicalJson(normalized));
        const existing = await this.readSnapshot();
        if (existing) {
          if (existing.execution_hash !== executionHash) return json({ error: "task_conflict" }, 409);
          return json({ ...existing, idempotent_replay: true });
        }
        const now = new Date().toISOString();
        const snapshot = {
          schema: "akashic.task-snapshot/v1",
          task_id: normalized.task_id,
          context_id: normalized.context_id,
          attempt_id: normalized.attempt_id,
          state: "SUBMITTED",
          terminal: false,
          seq: 1,
          task: normalized,
          execution_hash: executionHash,
          context_need: null,
          provider_session_id: null,
          provider_turn_id: null,
          created_at: now,
          updated_at: now,
          events: [{
            schema: "akashic.task-event/v1",
            task_id: normalized.task_id,
            seq: 1,
            kind: "TASK_SUBMITTED",
            from_state: null,
            to_state: "SUBMITTED",
            at: now,
            patch: {},
          }],
        };
        await this.writeSnapshot(snapshot);
        return json({ ...snapshot, accepted: true, idempotent_replay: false }, 202);
      }

      const snapshot = await this.readSnapshot();
      if (!snapshot) return json({ error: "task_not_found" }, 404);
      if (request.method === "GET" && url.pathname === "/snapshot") return json(snapshot);

      if (request.method === "POST" && url.pathname === "/context") {
        const { context_delta: delta } = await bodyJson(request);
        if (snapshot.state !== "INPUT_REQUIRED") return json({ error: "not_input_required" }, 409);
        if (!delta || delta.task_id !== snapshot.task_id || delta.attempt_id !== snapshot.attempt_id) {
          return json({ error: "context_identity_mismatch" }, 409);
        }
        if (delta.expected_seq !== snapshot.seq || delta.request_id !== snapshot.context_need?.request_id) {
          return json({ error: "stale_context_delta" }, 409);
        }
        const { snapshot: next } = appendEvent(snapshot, "CONTEXT_DELTA_APPLIED", "WORKING", {
          context_need: null,
          context_delta_sha256: await sha256Text(canonicalJson(delta)),
          last_context_packet_id: delta.packet_id,
        });
        await this.writeSnapshot(next);
        return json({ ...next, context_delta_accepted: true });
      }

      if (request.method === "POST" && url.pathname === "/cancel") {
        if (TERMINAL.has(snapshot.state)) return json({ ...snapshot, idempotent_replay: true });
        const { snapshot: next } = appendEvent(snapshot, "TASK_CANCELED", "CANCELED", {
          error: { code: "canceled", retryable: false },
        });
        await this.writeSnapshot(next);
        return json(next);
      }

      if (request.method === "POST" && url.pathname === "/transition") {
        const payload = await bodyJson(request);
        const toState = payload.to_state;
        const kind = payload.kind;
        if (typeof toState !== "string" || typeof kind !== "string") {
          return json({ error: "invalid_transition_payload" }, 400);
        }
        const patch = payload.patch && typeof payload.patch === "object" ? payload.patch : {};
        const { snapshot: next } = appendEvent(snapshot, kind, toState, patch);
        await this.writeSnapshot(next);
        return json(next);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "internal_error" }, 400);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({
        ok: true,
        service: "akashic-cloudflare-kernel",
        version: "0.6.0",
        durable_objects: true,
        execution_runner: "external or future Sandbox binding",
      });
    }
    const parsed = taskIdFromPath(url.pathname);
    if (request.method === "POST" && url.pathname === "/v1/tasks") {
      if (!bearerAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
      const payload = await bodyJson(request).catch((error) => ({ _error: error.message }));
      if (payload._error) return json({ error: payload._error }, 400);
      const taskId = payload.task?.task_id;
      if (typeof taskId !== "string" || !taskId) return json({ error: "task_id_required" }, 400);
      const id = env.TASK_KERNEL.idFromName(taskId);
      return env.TASK_KERNEL.get(id).fetch(new Request(new URL("/submit", url), {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(payload),
      }));
    }
    if (!parsed) return json({ error: "not_found" }, 404);
    if (request.method !== "GET" && !bearerAuthorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }
    const id = env.TASK_KERNEL.idFromName(parsed.taskId);
    const stub = env.TASK_KERNEL.get(id);
    const target = parsed.action === "get" ? "/snapshot" : `/${parsed.action}`;
    return stub.fetch(new Request(new URL(target, url), {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" ? undefined : await request.text(),
    }));
  },
};
