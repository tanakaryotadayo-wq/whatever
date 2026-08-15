import { createHash } from "node:crypto";

export const TASK_STATES = Object.freeze([
  "SUBMITTED", "COMPILING_CONTEXT", "WORKING", "INPUT_REQUIRED",
  "VERIFYING", "ADOPTING", "COMPLETED", "FAILED", "CANCELED"
]);
export const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "CANCELED"]);
export const TRANSITIONS = new Map([
  ["SUBMITTED", new Set(["COMPILING_CONTEXT", "FAILED", "CANCELED"])],
  ["COMPILING_CONTEXT", new Set(["WORKING", "FAILED", "CANCELED"])],
  ["WORKING", new Set(["INPUT_REQUIRED", "VERIFYING", "FAILED", "CANCELED"])],
  ["INPUT_REQUIRED", new Set(["WORKING", "FAILED", "CANCELED"])],
  ["VERIFYING", new Set(["ADOPTING", "FAILED", "CANCELED"])],
  ["ADOPTING", new Set(["COMPLETED", "FAILED", "CANCELED"])],
  ["COMPLETED", new Set()], ["FAILED", new Set()], ["CANCELED", new Set()]
]);

export class ContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.details = details;
  }
}
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}
export function requireString(value, path, max = 512) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new ContractError("INVALID_FIELD", `${path} must be a non-empty string <= ${max} chars`, { path });
  }
  return value;
}
export function validateArtifactRef(ref) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) throw new ContractError("INVALID_ARTIFACT_REF", "artifact ref must be an object");
  requireString(ref.media_type, "artifact.media_type", 256);
  requireString(ref.digest, "artifact.digest", 128);
  if (!/^sha256:[0-9a-f]{64}$/.test(ref.digest)) throw new ContractError("INVALID_DIGEST", "artifact.digest must be sha256:<64 lowercase hex>");
  if (!Number.isSafeInteger(ref.size) || ref.size < 0) throw new ContractError("INVALID_SIZE", "artifact.size must be a non-negative safe integer");
  requireString(ref.uri, "artifact.uri", 4096);
  return structuredClone(ref);
}
export function validateTaskCapsule(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new ContractError("INVALID_TASK", "task must be an object");
  for (const key of ["task_id", "context_id", "logical_attempt_id", "goal"]) requireString(task[key], `task.${key}`, key === "goal" ? 16000 : 256);
  if (!Array.isArray(task.acceptance) || task.acceptance.length === 0 || task.acceptance.length > 64) throw new ContractError("INVALID_ACCEPTANCE", "task.acceptance must contain 1..64 entries");
  task.acceptance.forEach((item, index) => requireString(item, `task.acceptance[${index}]`, 2048));
  if (task.context_refs !== undefined) task.context_refs.forEach(validateArtifactRef);
  return structuredClone(task);
}
export function validateTransition(from, to) {
  if (!TRANSITIONS.get(from)?.has(to)) throw new ContractError("ILLEGAL_TRANSITION", `illegal transition ${from} -> ${to}`, { from, to });
}
export function validateContextDelta(snapshot, delta) {
  if (!snapshot || !delta) throw new ContractError("INVALID_DELTA", "snapshot and delta are required");
  if (snapshot.state !== "INPUT_REQUIRED") throw new ContractError("NOT_INPUT_REQUIRED", "task is not waiting for context", { state: snapshot.state });
  for (const key of ["delta_id", "task_id", "request_id", "logical_attempt_id"]) requireString(delta[key], `delta.${key}`, 256);
  if (snapshot.task_id !== delta.task_id) throw new ContractError("TASK_MISMATCH", "delta task_id does not match");
  if (snapshot.logical_attempt_id !== delta.logical_attempt_id) throw new ContractError("ATTEMPT_MISMATCH", "delta logical_attempt_id does not match");
  if (snapshot.context_need?.request_id !== delta.request_id) throw new ContractError("REQUEST_MISMATCH", "delta request_id does not match current need");
  if (snapshot.context_seq !== delta.expected_seq) throw new ContractError("STALE_SEQUENCE", "delta expected_seq is stale", { expected: snapshot.context_seq, received: delta.expected_seq });
  if ((snapshot.applied_delta_ids ?? []).includes(delta.delta_id)) throw new ContractError("DUPLICATE_DELTA", "delta_id already applied", { delta_id: delta.delta_id });
  validateArtifactRef(delta.delta_ref);
  return structuredClone(delta);
}
export function makeEffectKey({ task_id, logical_attempt_id, turn_no, operation, subject_digest }) {
  return `effect:v1:${sha256({ task_id, logical_attempt_id, turn_no, operation, subject_digest })}`;
}
