import test from "node:test";
import assert from "node:assert/strict";
import { createRpcRouter } from "../src/rpc.js";

function fixture() {
  const calls = [];
  const handle = {
    query: async () => ({ state: "INPUT_REQUIRED" }),
    executeUpdate: async (_definition, options) => ({ accepted: true, options }),
  };
  const client = {
    workflow: {
      getHandle: (id) => (calls.push(["getHandle", id]), handle),
      executeUpdateWithStart: async (_definition, options) => (
        calls.push(["start", options.updateId]),
        { task_id: "t1", state: "SUBMITTED" }
      ),
    },
  };
  const operation = {
    workflowHandle: async () => ({ firstExecutionRunId: "run-1" }),
  };
  return { calls, client, operationFactory: () => operation };
}

test("runner maps read/update/cancel to one Temporal workflow id", async () => {
  const f = fixture();
  const route = createRpcRouter(f);
  assert.equal((await route("tasks/get", { id: "t1" })).state, "INPUT_REQUIRED");
  assert.equal(
    (
      await route("tasks/update", {
        id: "t1",
        context_delta: { delta_id: "d1" },
      })
    ).accepted,
    true,
  );
  assert.equal((await route("tasks/cancel", { id: "t1" })).accepted, true);
  assert.deepEqual(
    f.calls.filter(([kind]) => kind === "getHandle").map(([, id]) => id),
    ["t1", "t1", "t1"],
  );
});

test("runner submit uses Update-With-Start and a stable update id", async () => {
  const f = fixture();
  const route = createRpcRouter(f);
  const task = {
    schema: "akashic.task-capsule/v1",
    task_id: "t1",
    context_id: "c1",
    logical_attempt_id: "a1",
    goal: "g",
    acceptance: ["done"],
    context_refs: [],
  };
  const result = await route("tasks/send", { task });
  assert.equal(result.workflow_id, "t1");
  assert.equal(result.temporal_run_id, "run-1");
  assert.match(
    f.calls.find(([kind]) => kind === "start")[1],
    /^submit:t1:sha256:/,
  );
});

test("runner rejects legacy task capsules without an explicit schema", async () => {
  const route = createRpcRouter(fixture());
  await assert.rejects(
    route("tasks/send", {
      task: {
        task_id: "legacy",
        context_id: "c1",
        logical_attempt_id: "a1",
        goal: "g",
        acceptance: ["done"],
      },
    }),
    (error) => error.code === "INVALID_TASK_SCHEMA",
  );
});

test("unknown methods fail closed", async () => {
  await assert.rejects(
    createRpcRouter(fixture())("tasks/delete-everything", { id: "t1" }),
    /unsupported method/,
  );
});
