const INTERNAL_TO_MCP_STATUS = Object.freeze({
  SUBMITTED: "working",
  COMPILING_CONTEXT: "working",
  WORKING: "working",
  INPUT_REQUIRED: "input_required",
  VERIFYING: "working",
  ADOPTING: "working",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "cancelled",
});

export const MCP_TASK_EXTENSION_ID = "io.modelcontextprotocol/tasks";
export const MCP_TASK_STATUSES = Object.freeze(["working", "input_required", "completed", "cancelled", "failed"]);

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}
function timestamp(value, fallback) {
  const candidate = value ?? fallback;
  if (typeof candidate !== "string" || Number.isNaN(Date.parse(candidate))) throw new TypeError("MCP task timestamps must be ISO-8601 strings");
  return new Date(candidate).toISOString();
}
export function mapAkashicStateToMcpStatus(state) {
  const mapped = INTERNAL_TO_MCP_STATUS[state];
  if (!mapped) throw new TypeError(`unsupported Akashic task state: ${state}`);
  return mapped;
}
export function defaultContextInputRequests(contextNeed) {
  const requestId = requireNonEmptyString(contextNeed?.request_id, "contextNeed.request_id");
  return {
    [`context:${requestId}`]: {
      method: "elicitation/create",
      params: {
        mode: "form",
        message: contextNeed?.need?.description ?? contextNeed?.reason ?? "Provide the requested context delta.",
        requestedSchema: {
          type: "object",
          additionalProperties: false,
          required: ["context_delta"],
          properties: { context_delta: { type: "object", description: "CAS-guarded Akashic ContextPacketDeltaRefV1" } },
        },
      },
    },
  };
}
export function projectMcpTask(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new TypeError("snapshot must be an object");
  const taskId = requireNonEmptyString(snapshot.task_id, "snapshot.task_id");
  const status = mapAkashicStateToMcpStatus(snapshot.state);
  const createdAt = timestamp(options.createdAt ?? snapshot.created_at, snapshot.updated_at ?? options.now);
  const lastUpdatedAt = timestamp(snapshot.updated_at ?? options.lastUpdatedAt, createdAt);
  const ttlMs = options.ttlMs === undefined ? null : options.ttlMs;
  if (ttlMs !== null && (!Number.isSafeInteger(ttlMs) || ttlMs < 0)) throw new TypeError("ttlMs must be a non-negative safe integer or null");
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 100) throw new TypeError("pollIntervalMs must be a safe integer >= 100");
  const statusMessage = options.statusMessage ?? (status === "input_required"
    ? snapshot.context_need?.need?.description ?? snapshot.context_need?.reason ?? "Additional context is required."
    : status === "failed" ? snapshot.error?.message ?? snapshot.error?.code ?? "Task failed."
    : status === "cancelled" ? "Task cancellation was accepted."
    : status === "completed" ? snapshot.compact_result ?? "Task completed."
    : `Akashic task is ${String(snapshot.state).toLowerCase()}.`);
  const task = { resultType: options.creation ? "task" : "complete", taskId, status, statusMessage, createdAt, lastUpdatedAt, ttlMs, pollIntervalMs };
  if (status === "input_required") {
    if (!snapshot.context_need) throw new TypeError("INPUT_REQUIRED snapshot is missing context_need");
    task.inputRequests = (options.inputRequestFactory ?? defaultContextInputRequests)(snapshot.context_need, snapshot);
  } else if (status === "completed") {
    task.result = options.resultFactory ? options.resultFactory(snapshot) : {
      content: [{ type: "text", text: snapshot.compact_result ?? "Akashic task completed." }],
      structuredContent: { task_id: taskId, artifact_refs: snapshot.result_refs ?? snapshot.candidate_artifact_refs ?? (snapshot.adoption_ref ? [snapshot.adoption_ref] : []) },
    };
  } else if (status === "failed") {
    task.error = options.errorFactory ? options.errorFactory(snapshot) : { code: options.failureCode ?? -32000, message: snapshot.error?.message ?? snapshot.error?.code ?? "Akashic task failed", data: snapshot.error ?? null };
  }
  return task;
}
export function taskAuthorizationKey({ principal, taskId, audience = "akashic" }) {
  return `${audience}:${requireNonEmptyString(principal, "principal")}:${requireNonEmptyString(taskId, "taskId")}`;
}
