import assert from "node:assert/strict";
import test from "node:test";
import {
  applyContextDeltaToVercelSnapshot,
  initialVercelSnapshot,
  transitionVercelSnapshot,
} from "../workflows/run-agent-task.js";
import {
  contextHookToken,
  taskOwnerToken,
} from "../lib/vercel-workflow-ids.js";
import {
  readLatestSnapshotFromRun,
  rejectionProjection,
  snapshotProjection,
  synthesizeSnapshotForRunStatus,
} from "../lib/vercel-workflow-projection.js";

const digest = (character) => `sha256:${character.repeat(64)}`;
const artifact = (character, name) => ({
  media_type: "application/json",
  digest: digest(character),
  size: 1,
  uri: `fixture://${name}`,
});
const task = {
  schema: "akashic.task-capsule/v1",
  task_id: "task-1",
  context_id: "context-1",
  logical_attempt_id: "attempt-1",
  goal: "Close the Vercel Workflow fixture slice",
  acceptance: ["stale context is rejected", "verified artifact is adopted"],
  context_refs: [],
  execution_hash: digest("f"),
};

function waitingSnapshot() {
  return transitionVercelSnapshot(
    transitionVercelSnapshot(
      transitionVercelSnapshot(initialVercelSnapshot(task, "run-1"), "COMPILING_CONTEXT"),
      "WORKING",
      { turn_no: 1, compiled_context_ref: artifact("a", "compiled") },
    ),
    "INPUT_REQUIRED",
    {
      context_need: {
        schema: "akashic.context-need/v1",
        request_id: "need-1",
        task_id: "task-1",
        logical_attempt_id: "attempt-1",
        expected_seq: 0,
        missing: ["fixture.required-context"],
        known_digests: [],
        max_tokens: 1024,
      },
    },
  );
}

function delta(overrides = {}) {
  return {
    delta_id: "delta-1",
    task_id: "task-1",
    logical_attempt_id: "attempt-1",
    request_id: "need-1",
    expected_seq: 0,
    delta_ref: artifact("b", "delta"),
    ...overrides,
  };
}

test("Vercel snapshot preserves backend-neutral identities", () => {
  const snapshot = initialVercelSnapshot(task, "run-1");
  assert.equal(snapshot.task_id, task.task_id);
  assert.equal(snapshot.logical_attempt_id, task.logical_attempt_id);
  assert.equal(snapshot.submission_digest, task.execution_hash);
  assert.equal(snapshot.vercel_run_id, "run-1");
  assert.equal(snapshot.workflow_backend, "vercel-workflow");
});

test("stale context delta is rejected without snapshot mutation", () => {
  const before = waitingSnapshot();
  const frozen = structuredClone(before);
  assert.throws(
    () =>
      applyContextDeltaToVercelSnapshot(before, delta({ expected_seq: 99 })),
    (error) => error.code === "STALE_SEQUENCE",
  );
  assert.deepEqual(before, frozen);
});

test("valid context delta resumes the same logical attempt exactly once", () => {
  const before = waitingSnapshot();
  const after = applyContextDeltaToVercelSnapshot(before, delta());
  assert.equal(after.state, "WORKING");
  assert.equal(after.context_seq, 1);
  assert.equal(after.logical_attempt_id, before.logical_attempt_id);
  assert.deepEqual(after.applied_delta_ids, ["delta-1"]);
  assert.throws(
    () => applyContextDeltaToVercelSnapshot({ ...before, applied_delta_ids: ["delta-1"] }, delta()),
    (error) => error.code === "DUPLICATE_DELTA",
  );
});

test("terminal snapshots cannot be revived", () => {
  const completed = {
    ...waitingSnapshot(),
    state: "COMPLETED",
    terminal: true,
  };
  assert.deepEqual(
    transitionVercelSnapshot(completed, "WORKING"),
    completed,
  );
});

test("hook tokens are deterministic and bind the current request sequence", () => {
  const snapshot = waitingSnapshot();
  assert.equal(taskOwnerToken("task-1"), taskOwnerToken("task-1"));
  assert.notEqual(taskOwnerToken("task-1"), taskOwnerToken("task-2"));
  assert.match(contextHookToken(snapshot), /need-1:0$/);
  assert.notEqual(
    contextHookToken(snapshot),
    contextHookToken({ ...snapshot, context_seq: 1 }),
  );
});

function fakeRun(events) {
  return {
    getReadable({ startIndex = 0 } = {}) {
      const normalized = startIndex < 0
        ? Math.max(0, events.length + startIndex)
        : startIndex;
      const selected = events.slice(normalized);
      const stream = new ReadableStream({
        start(controller) {
          for (const event of selected) controller.enqueue(event);
          controller.close();
        },
      });
      return Object.assign(stream, {
        getTailIndex: async () => events.length - 1,
      });
    },
  };
}

test("projection reader skips rejection evidence and returns latest snapshot", async () => {
  const first = waitingSnapshot();
  const second = applyContextDeltaToVercelSnapshot(first, delta());
  const events = [
    snapshotProjection(first),
    rejectionProjection(first, { code: "STALE_SEQUENCE" }, delta({ expected_seq: 9 })),
    snapshotProjection(second),
  ];
  assert.deepEqual(await readLatestSnapshotFromRun(fakeRun(events)), second);
});

test("cancelled run status synthesizes a terminal Akashic snapshot", () => {
  const waiting = waitingSnapshot();
  const canceled = synthesizeSnapshotForRunStatus(waiting, "cancelled", "run-1");
  assert.equal(canceled.state, "CANCELED");
  assert.equal(canceled.terminal, true);
  assert.equal(canceled.error.code, "VERCEL_RUN_CANCELED");
});
