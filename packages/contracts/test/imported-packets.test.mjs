import test from "node:test";
import assert from "node:assert/strict";
import { EffectBusy, StaleFence, assertAdoptable, claimEffect, completeEffect, decideExecutionLane, decideSessionRecovery, evaluatePolicy, makeAgentProvenance, makeCloudEvent, makeContextCacheKey, makeVerificationReport, mapAkashicStateToMcpStatus, projectMcpTask, runPolicyTestVectors, taskAuthorizationKey, validateContextSection, validateTraceparent } from "../src/index.js";

const digest = (char) => `sha256:${char.repeat(64)}`;
const artifact = (char, uri = `cas://${char}`) => ({ media_type: "application/json", digest: digest(char), size: 1, uri });
const updated = "2026-08-16T00:00:00Z";

test("MCP Tasks projection preserves semantic state without becoming authority", () => {
  assert.equal(mapAkashicStateToMcpStatus("VERIFYING"), "working");
  const projected = projectMcpTask({ task_id: "task-1", state: "INPUT_REQUIRED", updated_at: updated, context_need: { request_id: "req-1", need: { description: "Need source file" } } }, { creation: false, ttlMs: null, pollIntervalMs: 1000 });
  assert.equal(projected.resultType, "complete"); assert.equal(projected.status, "input_required"); assert.equal(projected.taskId, "task-1");
  assert.equal(projected.inputRequests["context:req-1"].method, "elicitation/create");
  assert.equal(taskAuthorizationKey({ principal: "user-1", taskId: "task-1" }), "akashic:user-1:task-1");
});
test("fast versus durable routing is deterministic and reasoned", () => {
  const fast = decideExecutionLane({ task_id: "short", expected_minutes: 2 }); assert.equal(fast.lane, "fast"); assert.deepEqual(fast.reasons, ["SHORT_INTERACTIVE_TASK"]);
  const durable = decideExecutionLane({ task_id: "long", expected_minutes: 8, needs_wait: true, artifact_adoption: true }); assert.equal(durable.lane, "durable"); assert.deepEqual(durable.reasons, ["EXPECTED_DURATION", "EXTERNAL_INPUT_WAIT", "ARTIFACT_ADOPTION"]);
  const override = decideExecutionLane({ task_id: "override", restart_required: true, operator_override: "fast" }); assert.equal(override.lane, "fast"); assert.equal(override.automatic_lane, "durable");
});
test("policy-as-code defaults mutations to forbid and selects highest severity", () => {
  const rules = [{ id: "allow-read", effect: "allow", operations: ["artifact/read"], resource_prefixes: ["drive://"] }, { id: "prompt-adopt", effect: "prompt", operations: ["artifact/adopt"], resource_prefixes: ["github://"] }, { id: "forbid-main", effect: "forbid", operations: ["artifact/adopt"], resource_prefixes: ["github://main"] }];
  assert.equal(evaluatePolicy(rules, { operation: "artifact/read", resource: "drive://file/1", actor: "chatgpt", mutation: false }).decision, "allow");
  assert.equal(evaluatePolicy(rules, { operation: "artifact/adopt", resource: "github://repo/pr/3", actor: "chatgpt", mutation: true }).decision, "prompt");
  assert.equal(evaluatePolicy(rules, { operation: "artifact/adopt", resource: "github://main", actor: "chatgpt", mutation: true }).decision, "forbid");
  assert.equal(evaluatePolicy([], { operation: "unknown/write", resource: "x", mutation: true }).decision, "forbid");
  assert.equal(runPolicyTestVectors(rules, [{ name: "deny-main", request: { operation: "artifact/adopt", resource: "github://main", mutation: true }, expect: "forbid" }])[0].passed, true);
});
test("CloudEvent projection validates W3C trace context", () => {
  const traceparent = `00-${"1".repeat(32)}-${"2".repeat(16)}-01`; assert.equal(validateTraceparent(traceparent), traceparent);
  const event = makeCloudEvent({ id: "evt-1", source: "https://akashic.dev/workflows", type: "dev.akashic.task.input-required.v1", subject: "tasks/task-1", time: updated, traceparent, data: { task_id: "task-1" } });
  assert.equal(event.specversion, "1.0"); assert.equal(event.data.task_id, "task-1"); assert.throws(() => validateTraceparent(`00-${"0".repeat(32)}-${"2".repeat(16)}-01`));
});
test("three-zone context and query-time cache key preserve source identity", () => {
  assert.equal(validateContextSection({ zone: "WORKING_MEMORY", source_refs: [artifact("a")], derived_from: [digest("b")], content: "selected context" }).zone, "WORKING_MEMORY");
  const key1 = makeContextCacheKey({ need_digest: digest("a"), corpus_revision: "git:abc", recipient_seen_digest: digest("b"), compiler_version: "v1" });
  const key2 = makeContextCacheKey({ need_digest: digest("a"), corpus_revision: "git:abc", recipient_seen_digest: digest("b"), compiler_version: "v1" });
  const key3 = makeContextCacheKey({ need_digest: digest("a"), corpus_revision: "git:def", recipient_seen_digest: digest("b"), compiler_version: "v1" });
  assert.equal(key1, key2); assert.notEqual(key1, key3);
});
test("effect ledger contract enforces generation fencing", () => {
  const initial = claimEffect(null, { effect_key: "effect-1", subject_digest: digest("a"), owner: "worker-1" }); assert.equal(initial.generation, 1);
  assert.throws(() => claimEffect(initial, { effect_key: "effect-1", subject_digest: digest("a"), owner: "worker-2" }), EffectBusy);
  const takeover = claimEffect(initial, { effect_key: "effect-1", subject_digest: digest("a"), owner: "worker-2", takeover: true }); assert.equal(takeover.generation, 2);
  assert.throws(() => completeEffect(takeover, { owner: "worker-1", generation: 1, result_digest: digest("b") }), StaleFence);
  const complete = completeEffect(takeover, { owner: "worker-2", generation: 2, result_digest: digest("b") }); assert.equal(complete.status, "SUCCEEDED");
  assert.equal(completeEffect(complete, { owner: "worker-x", generation: 999, result_digest: digest("b") }).idempotent_replay, true);
});
test("provenance and versioned verification are required before adoption", () => {
  const candidate = artifact("c");
  const provenance = makeAgentProvenance({ provenance_id: "prov-1", source: { repository: "tanakaryotadayo-wq/whatever", commit: "abc123", tree: "tree123" }, run: { task_id: "task-1", context_id: "ctx-1", logical_attempt_id: "la-1", turn_no: 2 }, agent: { provider: "fixture", adapter_version: "1", session_capability: "RECONSTRUCTIBLE_SESSION" }, context_inputs: [artifact("a")], outputs: [candidate], evidence_refs: [artifact("e")], started_at: updated, completed_at: "2026-08-16T00:01:00Z" });
  const report = makeVerificationReport({ verification_id: "verify-1", subject_digest: candidate.digest, decision: "PASS", verifier: { id: "fixture-verifier", version: "1" }, policy_version: "v1", checks: [{ check_id: "hash", kind: "hash", status: "PASS", required: true, evidence_refs: [artifact("e")] }], completed_at: "2026-08-16T00:02:00Z" });
  assert.deepEqual(assertAdoptable({ candidate_ref: candidate, verification_report: report, provenance }), { subject_digest: candidate.digest, verification_id: "verify-1", provenance_id: "prov-1" });
  assert.throws(() => assertAdoptable({ candidate_ref: artifact("d"), verification_report: report, provenance }), /MISMATCH/);
});
test("session recovery matrix fails closed when evidence is absent", () => {
  assert.deepEqual(decideSessionRecovery("PERSISTENT_WITH_RECONCILIATION", { session_available: true }), { action: "RESUME_AND_RECONCILE", fail_closed: false });
  assert.equal(decideSessionRecovery("RECONSTRUCTIBLE_SESSION", { reconstruction_inputs_available: false }).fail_closed, true);
  assert.equal(decideSessionRecovery("EPHEMERAL_SESSION", {}).action, "FAIL_CLOSED_EPHEMERAL_SESSION");
});
