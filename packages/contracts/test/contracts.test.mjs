import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, sha256, validateArtifactRef, validateContextDelta, ContractError, makeEffectKey } from "../src/index.js";

const ref = { media_type: "application/json", digest: `sha256:${"a".repeat(64)}`, size: 3, uri: "file://a" };
const snapshot = { task_id: "t1", logical_attempt_id: "a1", state: "INPUT_REQUIRED", context_seq: 4, context_need: { request_id: "r1" }, applied_delta_ids: [] };
const delta = { delta_id: "d1", task_id: "t1", logical_attempt_id: "a1", request_id: "r1", expected_seq: 4, delta_ref: ref };

test("canonical JSON and hashes are key-order independent", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(sha256({ b: 2, a: 1 }), sha256({ a: 1, b: 2 }));
});
test("ArtifactRef is digest guarded", () => {
  assert.equal(validateArtifactRef(ref).digest, ref.digest);
  assert.throws(() => validateArtifactRef({ ...ref, digest: "bad" }), ContractError);
});
test("Context delta accepts exact CAS and rejects stale sequence", () => {
  assert.equal(validateContextDelta(snapshot, delta).delta_id, "d1");
  assert.throws(() => validateContextDelta(snapshot, { ...delta, expected_seq: 3 }), (error) => error.code === "STALE_SEQUENCE");
});
test("effect identity is deterministic and operation-sensitive", () => {
  const base = { task_id: "t1", logical_attempt_id: "a1", turn_no: 1, operation: "adopt", subject_digest: ref.digest };
  assert.equal(makeEffectKey(base), makeEffectKey({ ...base }));
  assert.notEqual(makeEffectKey(base), makeEffectKey({ ...base, operation: "store" }));
});
