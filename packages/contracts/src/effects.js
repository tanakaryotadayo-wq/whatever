export const EFFECT_STATUSES = Object.freeze(["STARTED", "SUCCEEDED", "FAILED"]);
function requireDigest(value, name) { if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new TypeError(`${name} must be sha256:<64 lowercase hex>`); return value; }
function requireString(value, name) { if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`); return value; }
export class EffectConflict extends Error { constructor(message) { super(message); this.name = "EffectConflict"; this.code = "EFFECT_CONFLICT"; } }
export class EffectBusy extends Error { constructor(message) { super(message); this.name = "EffectBusy"; this.code = "EFFECT_BUSY"; } }
export class StaleFence extends Error { constructor(message) { super(message); this.name = "StaleFence"; this.code = "STALE_FENCE"; } }
export function validateEffectRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new TypeError("effect record must be an object");
  requireString(record.effect_key, "effect_key"); requireDigest(record.subject_digest, "subject_digest"); requireString(record.owner, "owner");
  if (!Number.isSafeInteger(record.generation) || record.generation < 1) throw new TypeError("generation must be a positive safe integer");
  if (!EFFECT_STATUSES.includes(record.status)) throw new TypeError("invalid effect status");
  if (record.result_digest !== null && record.result_digest !== undefined) requireDigest(record.result_digest, "result_digest");
  return structuredClone(record);
}
export function claimEffect(existing, request) {
  requireString(request?.effect_key, "effect_key"); requireDigest(request?.subject_digest, "subject_digest"); requireString(request?.owner, "owner");
  if (existing == null) return { schema: "akashic.effect-record/v1", effect_key: request.effect_key, subject_digest: request.subject_digest, owner: request.owner, generation: 1, status: "STARTED", result_digest: null, idempotent_replay: false };
  const current = validateEffectRecord(existing);
  if (current.effect_key !== request.effect_key || current.subject_digest !== request.subject_digest) throw new EffectConflict("effect identity was reused for a different subject");
  if (current.status === "SUCCEEDED") return { ...current, idempotent_replay: true };
  if (current.owner === request.owner) return { ...current, idempotent_replay: true };
  if (request.takeover !== true) throw new EffectBusy(`effect is owned by ${current.owner}`);
  return { ...current, owner: request.owner, generation: current.generation + 1, status: "STARTED", result_digest: null, idempotent_replay: false };
}
export function completeEffect(existing, completion) {
  const current = validateEffectRecord(existing); requireString(completion?.owner, "completion.owner"); requireDigest(completion?.result_digest, "completion.result_digest");
  if (!Number.isSafeInteger(completion?.generation) || completion.generation < 1) throw new TypeError("completion.generation must be positive");
  if (current.status === "SUCCEEDED") { if (current.result_digest !== completion.result_digest) throw new EffectConflict("effect already succeeded with a different result"); return { ...current, idempotent_replay: true }; }
  if (current.owner !== completion.owner || current.generation !== completion.generation) throw new StaleFence("effect completion used a stale owner or generation");
  return { ...current, status: "SUCCEEDED", result_digest: completion.result_digest, idempotent_replay: false };
}
export function failEffect(existing, failure) {
  const current = validateEffectRecord(existing);
  if (current.owner !== failure?.owner || current.generation !== failure?.generation) throw new StaleFence("failure used a stale owner or generation");
  return { ...current, status: "FAILED", failure_code: failure.code ?? "UNKNOWN", idempotent_replay: false };
}
