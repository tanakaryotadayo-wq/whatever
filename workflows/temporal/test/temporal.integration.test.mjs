import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WithStartWorkflowOperation } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { applyContextDelta, getTaskSnapshot, submitTask, TASK_QUEUES } from "../src/shared.js";
import { createWorkerTopology } from "../src/worker-topology.js";
import { runAgentTaskWorkflow } from "../src/workflows.js";

async function waitForState(handle, expected) {
  for (let i = 0; i < 100; i += 1) {
    const snapshot = await handle.query(getTaskSnapshot);
    if (snapshot.state === expected) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`workflow did not reach ${expected}`);
}

test("P0 durable context negotiation crosses isolated role queues and closes through adoption", { timeout: 120000 }, async () => {
  const runtime = await mkdtemp(join(tmpdir(), "akashic-temporal-"));
  process.env.AKASHIC_RUNTIME_ROOT = runtime;
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const entries = await createWorkerTopology({
    connection: env.nativeConnection,
    namespace: "default",
    env: { AKASHIC_TEMPORAL_VERSIONING: "0" }
  });
  const workflowEntry = entries.find((entry) => entry.role === "workflow");
  const activityEntries = entries.filter((entry) => entry.role !== "workflow");
  const activityRuns = activityEntries.map(({ worker }) => worker.run());

  try {
    await workflowEntry.worker.runUntil(async () => {
      const task = {
        schema: "akashic.task-capsule/v1",
        task_id: "task-p0",
        context_id: "context-p0",
        logical_attempt_id: "attempt-p0",
        goal: "Complete the fixture vertical slice",
        acceptance: ["Context CAS is enforced", "Artifact is verified before adoption"],
        context_refs: [],
        execution_hash: `sha256:${"c".repeat(64)}`
      };
      const start = new WithStartWorkflowOperation(runAgentTaskWorkflow, {
        workflowId: task.task_id,
        taskQueue: TASK_QUEUES.workflow,
        workflowIdConflictPolicy: "FAIL"
      });
      const submitted = await env.client.workflow.executeUpdateWithStart(submitTask, {
        startWorkflowOperation: start,
        args: [task],
        updateId: `submit:${task.task_id}`
      });
      assert.equal(submitted.task_id, task.task_id);
      const handle = await start.workflowHandle();
      const waiting = await waitForState(handle, "INPUT_REQUIRED");
      assert.equal(waiting.context_need.expected_seq, 0);
      const ref = {
        media_type: "application/json",
        digest: `sha256:${"d".repeat(64)}`,
        size: 2,
        uri: "file://fixture-delta"
      };
      const delta = {
        delta_id: "delta-p0",
        task_id: task.task_id,
        logical_attempt_id: task.logical_attempt_id,
        request_id: waiting.context_need.request_id,
        expected_seq: waiting.context_seq,
        delta_ref: ref
      };
      await assert.rejects(
        handle.executeUpdate(applyContextDelta, {
          args: [{ ...delta, delta_id: "delta-stale", expected_seq: waiting.context_seq + 1 }],
          updateId: "delta-stale"
        })
      );
      const accepted = await handle.executeUpdate(applyContextDelta, {
        args: [delta],
        updateId: delta.delta_id
      });
      assert.equal(accepted.context_seq, 1);
      const result = await handle.result();
      assert.equal(result.state, "COMPLETED");
      assert.equal(result.terminal, true);
      assert.match(result.adoption_ref.digest, /^sha256:/);
      assert.equal(result.applied_delta_ids.length, 1);
    });
  } finally {
    for (const { worker } of activityEntries) worker.shutdown();
    await Promise.allSettled(activityRuns);
    await env.teardown();
    await rm(runtime, { recursive: true, force: true });
  }
});
