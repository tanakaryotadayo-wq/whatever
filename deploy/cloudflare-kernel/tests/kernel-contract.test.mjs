import assert from "node:assert/strict";
import test from "node:test";
import {
  appendEvent,
  canonicalJson,
  validateTask,
  validateTransition,
} from "../src/kernel-contract.js";

const task = {
  task_id: "task-1",
  context_id: "ctx-1",
  attempt_id: "attempt-1",
  goal: "test",
  acceptance: ["passes"],
};

test("canonical JSON is key-order independent", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("task contract requires explicit identity and acceptance", () => {
  assert.equal(validateTask(task).task_id, "task-1");
  assert.throws(() => validateTask({ ...task, acceptance: [] }));
});

test("terminal transitions are immutable", () => {
  assert.throws(() => validateTransition("COMPLETED", "WORKING"));
});

test("appendEvent advances monotonic seq", () => {
  const snapshot = {
    task_id: "task-1",
    state: "SUBMITTED",
    terminal: false,
    seq: 1,
    events: [],
  };
  const result = appendEvent(snapshot, "PROCESS_STARTED", "WORKING");
  assert.equal(result.event.seq, 2);
  assert.equal(result.snapshot.state, "WORKING");
});
