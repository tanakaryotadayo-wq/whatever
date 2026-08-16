import test from "node:test";
import assert from "node:assert/strict";
import { scoreBackendResult } from "../score.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const allGates = {
  idempotent_start: true,
  input_required_wait: true,
  stale_input_rejected_without_mutation: true,
  valid_input_resumes_same_logical_attempt: true,
  worker_restart_recovery: true,
  cancellation: true,
  effect_retry_is_idempotent: true,
  session_loss_fails_closed_or_reconciles: true,
  workflow_version_rollout: true,
  off_platform_worker: true,
  compact_ref_only_history: true,
};

function result(patch = {}) {
  return {
    schema: "akashic.orchestrator-bakeoff-result/v1",
    backend: "temporal",
    scenario_id: "run-agent-task-v1",
    source_commit: "abcdef123",
    gates: allGates,
    disqualifiers: [],
    evidence_refs: [{ uri: "drive://evidence/1", digest }],
    metrics: {},
    operational_components: 4,
    ...patch,
  };
}

test("fully evidenced backend qualifies", async () => {
  const score = await scoreBackendResult(result());
  assert.equal(score.qualified, true);
  assert.equal(score.score, 100);
});

test("mandatory failure cannot be hidden by feature score", async () => {
  const score = await scoreBackendResult(result({ gates: { ...allGates, stale_input_rejected_without_mutation: false } }));
  assert.equal(score.qualified, false);
  assert.equal(score.mandatory_passed, false);
});

test("dual authority and missing digest disqualify", async () => {
  const score = await scoreBackendResult(result({ disqualifiers: ["dual_task_authority"], evidence_refs: [{ uri: "x", digest: "bad" }] }));
  assert.equal(score.qualified, false);
  assert.deepEqual(score.disqualifiers, ["dual_task_authority", "evidence_missing_digest"]);
});
