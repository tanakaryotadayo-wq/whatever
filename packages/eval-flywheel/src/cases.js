import { canonicalJson, sha256, validateArtifactRef } from "@akashic/contracts";

export const EVAL_CASE_STATUSES = Object.freeze(["CANDIDATE", "ACCEPTED", "RETIRED"]);
export const DETERMINISTIC_GRADERS = Object.freeze(["exact", "subset", "error_code", "ordered_values"]);

function requireString(value, name, max = 512) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new TypeError(`${name} must be a non-empty string <= ${max}`);
  return value;
}
function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

export function evalCaseDigest(value) {
  const copy = structuredClone(value);
  delete copy.case_digest;
  return `sha256:${sha256(canonicalJson(copy))}`;
}

export function validateEvalCase(value) {
  const item = requireObject(value, "eval case");
  if (item.schema !== "akashic.eval-case/v1") throw new TypeError("unsupported eval case schema");
  requireString(item.case_id, "case_id", 160);
  requireString(item.capability, "capability", 255);
  if (!EVAL_CASE_STATUSES.includes(item.status)) throw new TypeError("invalid eval case status");
  requireObject(item.input, "input");
  const expected = requireObject(item.expected, "expected");
  if (!DETERMINISTIC_GRADERS.includes(expected.kind)) throw new TypeError(`unsupported deterministic grader: ${expected.kind}`);
  if (expected.kind === "error_code") requireString(expected.code, "expected.code", 255);
  if (expected.kind === "ordered_values" && (!Array.isArray(expected.values) || expected.values.length === 0)) throw new TypeError("ordered_values grader requires values");
  const sourceRefs = item.source_refs ?? [];
  if (!Array.isArray(sourceRefs)) throw new TypeError("source_refs must be an array");
  sourceRefs.forEach(validateArtifactRef);
  if (item.status === "CANDIDATE" && sourceRefs.length === 0) throw new TypeError("candidate eval cases require immutable source_refs");
  if (item.verification_ref !== undefined && item.verification_ref !== null) validateArtifactRef(item.verification_ref);
  if (item.status === "ACCEPTED" && typeof item.accepted_by !== "string") throw new TypeError("accepted eval cases require accepted_by");
  if (item.case_digest !== undefined && item.case_digest !== evalCaseDigest(item)) throw new TypeError("eval case digest mismatch");
  return structuredClone(item);
}

export function makeEvalCandidate({ case_id, capability, input, expected, source_refs, tags = [], created_at = new Date().toISOString() }) {
  const candidate = {
    schema: "akashic.eval-case/v1",
    case_id,
    capability,
    status: "CANDIDATE",
    input: structuredClone(input),
    expected: structuredClone(expected),
    source_refs: structuredClone(source_refs),
    tags: [...new Set(tags)].sort(),
    created_at
  };
  candidate.case_digest = evalCaseDigest(candidate);
  return validateEvalCase(candidate);
}

export function acceptEvalCandidate(candidate, { verification_ref, accepted_by, accepted_at = new Date().toISOString() }) {
  const checked = validateEvalCase(candidate);
  if (checked.status !== "CANDIDATE") throw new TypeError("only CANDIDATE eval cases can be accepted");
  validateArtifactRef(verification_ref);
  requireString(accepted_by, "accepted_by", 255);
  const accepted = { ...checked, status: "ACCEPTED", verification_ref: structuredClone(verification_ref), accepted_by, accepted_at };
  accepted.case_digest = evalCaseDigest(accepted);
  return validateEvalCase(accepted);
}
