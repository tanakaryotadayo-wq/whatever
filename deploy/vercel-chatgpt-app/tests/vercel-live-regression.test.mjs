import assert from "node:assert/strict";
import test from "node:test";
import {
  applyContextDeltaToVercelSnapshot,
  beginAgentTurn,
  initialVercelSnapshot,
  transitionVercelSnapshot,
} from "../workflows/run-agent-task.js";

const digest = (character) => `sha256:${character.repeat(64)}`;
const task = {
  schema: "akashic.task-capsule/v1",
  task_id: "turn-resume-task",
  context_id: "turn-resume-context",
  logical_attempt_id: "turn-resume-attempt",
  goal: "Resume a second Agent turn after context",
  acceptance: ["no WORKING to WORKING transition error"],
  context_refs: [],
  execution_hash: digest("f"),
};
const ref = {
  media_type: "application/json",
  digest: digest("a"),
  size: 1,
  uri: "fixture://delta",
};

function waitingSnapshot() {
  const submitted = initialVercelSnapshot(task, "run-1");
  const compiling = transitionVercelSnapshot(submitted, "COMPILING_CONTEXT");
  const working = beginAgentTurn(compiling);
  return transitionVercelSnapshot(working, "INPUT_REQUIRED", {
    context_need: {
      schema: "akashic.context-need/v1",
      request_id: "need-1",
      task_id: task.task_id,
      logical_attempt_id: task.logical_attempt_id,
      expected_seq: 0,
      missing: ["context"],
      known_digests: [],
      max_tokens: 1024,
    },
  });
}

test("accepted context starts turn 2 without an illegal WORKING self-transition", () => {
  const resumed = applyContextDeltaToVercelSnapshot(waitingSnapshot(), {
    delta_id: "delta-1",
    task_id: task.task_id,
    logical_attempt_id: task.logical_attempt_id,
    request_id: "need-1",
    expected_seq: 0,
    delta_ref: ref,
  });
  assert.equal(resumed.state, "WORKING");
  assert.equal(resumed.turn_no, 1);
  const secondTurn = beginAgentTurn(resumed);
  assert.equal(secondTurn.state, "WORKING");
  assert.equal(secondTurn.turn_no, 2);
  assert.equal(secondTurn.state_seq, resumed.state_seq + 1);
});
