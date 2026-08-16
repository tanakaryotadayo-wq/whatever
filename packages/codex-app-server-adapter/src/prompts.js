import { validateStructuredTurnOutput } from "./turn-output.js";

export function assertTurnIdentity(turn, expected) {
  validateStructuredTurnOutput(turn);
  if (turn.outcome !== expected.outcome) {
    throw new Error(`expected ${expected.outcome}, got ${turn.outcome}`);
  }
  if (turn.outcome === "INPUT_REQUIRED") {
    const need = turn.context_need;
    for (const key of ["task_id", "logical_attempt_id", "request_id", "expected_seq"]) {
      if (need[key] !== expected[key]) {
        throw new Error(`ContextNeed ${key} mismatch: ${need[key]} != ${expected[key]}`);
      }
    }
    if (turn.artifact_paths.length !== 0) {
      throw new Error("turn 1 must not report artifacts");
    }
  }
}

export function buildTurnOnePrompt(task, taskMarkdown) {
  return [
    "Execute this Akashic Task Capsule inside the current workspace.",
    "The required external context value has intentionally NOT been provided.",
    "Do not guess it, do not create placeholders, and do not create result.txt yet.",
    "Return only the JSON object required by the supplied outputSchema.",
    "When context is missing, outcome must be INPUT_REQUIRED and context_need must use the exact identities below.",
    "",
    JSON.stringify({
      schema: "akashic.task-capsule/v1",
      task_id: task.task_id,
      context_id: task.context_id,
      logical_attempt_id: task.logical_attempt_id,
      goal: task.goal,
      acceptance: task.acceptance,
      context_seq: 0,
      required_request_id: task.request_id,
    }, null, 2),
    "",
    "TASK.md:",
    taskMarkdown,
  ].join("\n");
}

export function buildTurnTwoPrompt(delta) {
  return [
    "Continue the current Task using only this ContextPacketDelta.",
    "Do not request or restate the original Task Capsule.",
    "Write result.txt in the current workspace containing content.required_value followed by one newline.",
    "Then return only the JSON object required by the supplied outputSchema.",
    JSON.stringify(delta, null, 2),
  ].join("\n");
}
