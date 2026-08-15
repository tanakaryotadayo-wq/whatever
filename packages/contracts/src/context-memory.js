import { createHash } from "node:crypto";
export const CONTEXT_ZONES = Object.freeze(["TASK_SEMANTICS", "WORKING_MEMORY", "RECENT_EVIDENCE"]);
export function validateContextSection(section) {
  if (!section || typeof section !== "object" || Array.isArray(section)) throw new TypeError("context section must be an object");
  if (!CONTEXT_ZONES.includes(section.zone)) throw new TypeError(`invalid context zone: ${section.zone}`);
  if (!Array.isArray(section.source_refs) || section.source_refs.length === 0) throw new TypeError("context section requires immutable source_refs");
  if (section.derived_from !== undefined && !Array.isArray(section.derived_from)) throw new TypeError("derived_from must be an array");
  if (typeof section.content !== "string" && typeof section.content_ref !== "object") throw new TypeError("context section requires content or content_ref");
  return structuredClone(section);
}
export function makeContextCacheKey(input) {
  const required = ["need_digest", "corpus_revision", "recipient_seen_digest", "compiler_version"];
  for (const key of required) if (typeof input?.[key] !== "string" || input[key].length === 0) throw new TypeError(`${key} is required`);
  const canonical = required.map((key) => `${key}=${input[key]}`).join("\n");
  return `ctxcache:v1:${createHash("sha256").update(canonical).digest("hex")}`;
}
