import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export function extractFinalAgentMessage(turn, observedItems = []) {
  const candidates = [
    ...(Array.isArray(turn?.items) ? turn.items : []),
    ...observedItems,
  ].filter((item) => item?.type === "agentMessage" && typeof item.text === "string");
  const final = candidates.at(-1);
  if (!final) {
    const error = new Error("turn completed without an agentMessage item");
    error.code = "CODEX_MISSING_AGENT_MESSAGE";
    throw error;
  }
  return final.text;
}

export function parseStructuredTurnOutput(text) {
  const trimmed = String(text).trim();
  if (!trimmed || trimmed.startsWith("```") || trimmed.endsWith("```")) {
    const error = new Error("assistant output must be raw JSON without code fences");
    error.code = "CODEX_INVALID_STRUCTURED_OUTPUT";
    throw error;
  }
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch (cause) {
    const error = new Error("assistant output is not valid JSON");
    error.code = "CODEX_INVALID_STRUCTURED_OUTPUT";
    error.cause = cause;
    throw error;
  }
  validateStructuredTurnOutput(value);
  return value;
}

export function validateStructuredTurnOutput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("structured output must be an object");
  }
  const allowed = new Set([
    "outcome",
    "context_need",
    "compact_result",
    "artifact_paths",
    "evidence",
  ]);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowed.has(key)) throw new TypeError(`unexpected output property: ${key}`);
  }
  for (const key of allowed) {
    if (!keys.includes(key)) throw new TypeError(`missing output property: ${key}`);
  }
  if (!["INPUT_REQUIRED", "COMPLETED", "FAILED"].includes(value.outcome)) {
    throw new TypeError("invalid outcome");
  }
  if (value.compact_result !== null && typeof value.compact_result !== "string") {
    throw new TypeError("compact_result must be string or null");
  }
  for (const key of ["artifact_paths", "evidence"]) {
    if (!Array.isArray(value[key]) || value[key].some((entry) => typeof entry !== "string")) {
      throw new TypeError(`${key} must be an array of strings`);
    }
  }
  if (value.context_need !== null) {
    const need = value.context_need;
    if (!need || typeof need !== "object" || Array.isArray(need)) {
      throw new TypeError("context_need must be object or null");
    }
    const required = [
      "request_id",
      "task_id",
      "logical_attempt_id",
      "expected_seq",
      "missing",
      "known_digests",
      "max_tokens",
    ];
    for (const key of required) {
      if (!(key in need)) throw new TypeError(`context_need missing ${key}`);
    }
    for (const key of ["request_id", "task_id", "logical_attempt_id"]) {
      if (typeof need[key] !== "string" || !need[key]) throw new TypeError(`invalid context_need.${key}`);
    }
    if (!Number.isInteger(need.expected_seq) || need.expected_seq < 0) {
      throw new TypeError("invalid context_need.expected_seq");
    }
    if (!Number.isInteger(need.max_tokens) || need.max_tokens < 1) {
      throw new TypeError("invalid context_need.max_tokens");
    }
    for (const key of ["missing", "known_digests"]) {
      if (!Array.isArray(need[key]) || need[key].some((entry) => typeof entry !== "string")) {
        throw new TypeError(`invalid context_need.${key}`);
      }
    }
  }
  if (value.outcome === "INPUT_REQUIRED" && value.context_need === null) {
    throw new TypeError("INPUT_REQUIRED requires context_need");
  }
  if (value.outcome !== "INPUT_REQUIRED" && value.context_need !== null) {
    throw new TypeError(`${value.outcome} requires context_need=null`);
  }
  return value;
}

export async function artifactRefForFile(filePath, { workspaceRoot } = {}) {
  const resolved = path.resolve(filePath);
  if (workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("artifact path escapes certification workspace");
    }
  }
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error(`artifact is not a file: ${resolved}`);
  const bytes = await readFile(resolved);
  const digest = createHash("sha256").update(bytes).digest("hex");
  return {
    schema: "akashic.artifact-ref/v1",
    media_type: "text/plain",
    digest: `sha256:${digest}`,
    size: bytes.length,
    uri: `file://${resolved}`,
    artifact_type: "akashic.codex-live-result/v1",
  };
}
