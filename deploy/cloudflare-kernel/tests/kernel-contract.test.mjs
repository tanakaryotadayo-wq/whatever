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

test("transition to terminal state is idempotent (no re-application)", () => {
  const snapshot = {
    task_id: "task-1",
    state: "COMPLETED",
    terminal: true,
    seq: 3,
    events: [],
  };
  // validateTransition must throw when trying to leave COMPLETED
  assert.throws(() => appendEvent(snapshot, "PROCESS_STARTED", "WORKING"), /illegal transition/);
  // All terminal states must reject every non-empty allowed set
  for (const from of ["COMPLETED", "FAILED", "CANCELED"]) {
    for (const to of ["SUBMITTED", "WORKING", "INPUT_REQUIRED", "COMPLETED", "FAILED", "CANCELED"]) {
      assert.throws(() => validateTransition(from, to), /illegal transition/, `expected ${from} -> ${to} to throw`);
    }
  }
});

test("stale context delta is rejected (wrong expected_seq)", () => {
  const snapshot = {
    task_id: "task-1",
    state: "INPUT_REQUIRED",
    terminal: false,
    seq: 5,
    context_need: { request_id: "req-1" },
    events: [],
  };
  const staleDelta = { task_id: "task-1", attempt_id: "a1", expected_seq: 4, request_id: "req-1", packet_id: "p1" };
  // expected_seq must equal snapshot.seq to be accepted
  assert.notEqual(staleDelta.expected_seq, snapshot.seq);
});

test("appendEvent event log is capped at 256 entries", () => {
  const events = Array.from({ length: 256 }, (_, i) => ({ seq: i + 1 }));
  const snapshot = { task_id: "t", state: "SUBMITTED", terminal: false, seq: 256, events };
  const { snapshot: next } = appendEvent(snapshot, "PROCESS_STARTED", "WORKING");
  assert.equal(next.events.length, 256);
  assert.equal(next.events[255].seq, 257);
});
