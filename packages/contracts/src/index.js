import { createHash } from "node:crypto";

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(bytes).digest("hex");
}

export function makeEffectKey({
  task_id,
  logical_attempt_id,
  turn_no,
  operation,
  subject_digest,
}) {
  return `effect:v1:${sha256({
    task_id,
    logical_attempt_id,
    turn_no,
    operation,
    subject_digest,
  })}`;
}

export * from "./task-state.js";
export * from "./mcp-tasks.js";
export * from "./routing.js";
export * from "./policy.js";
export * from "./events.js";
export * from "./context-memory.js";
export * from "./sessions.js";
export * from "./effects.js";
export * from "./provenance.js";
