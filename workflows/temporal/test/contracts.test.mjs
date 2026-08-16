import test from "node:test";
import assert from "node:assert/strict";
import { assertDeltaAllowed } from "../src/workflow-contracts.js";

const snapshot = {
  state: "INPUT_REQUIRED", task_id: "task-1", logical_attempt_id: "attempt-1",
  context_seq: 0, context_need: { request_id: "need-1" }, applied_delta_ids: []
};
const ref = { digest: `sha256:${"b".repeat(64)}`, uri: "file://delta" };
const delta = { delta_id: "delta-1", task_id: "task-1", logical_attempt_id: "attempt-1", request_id: "need-1", expected_seq: 0, delta_ref: ref };

test("exact context CAS is accepted", () => assert.doesNotThrow(() => assertDeltaAllowed(snapshot, delta)));
test("stale context sequence is rejected", () => assert.throws(() => assertDeltaAllowed(snapshot, { ...delta, expected_seq: 1 }), /STALE_SEQUENCE/));
test("old request cannot revive a waiting task", () => assert.throws(() => assertDeltaAllowed(snapshot, { ...delta, request_id: "old" }), /REQUEST_MISMATCH/));
