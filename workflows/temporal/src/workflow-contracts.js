const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELED"]);
export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function assertTask(task) {
  if (!task || typeof task !== "object") throw new Error("task is required");
  for (const key of ["task_id", "context_id", "logical_attempt_id", "goal", "execution_hash"]) {
    if (typeof task[key] !== "string" || task[key].length === 0) throw new Error(`task.${key} is required`);
  }
  if (!Array.isArray(task.acceptance) || task.acceptance.length === 0) throw new Error("task.acceptance is required");
}
export function assertDeltaAllowed(snapshot, delta) {
  if (snapshot.state !== "INPUT_REQUIRED") throw new Error(`NOT_INPUT_REQUIRED:${snapshot.state}`);
  if (!delta || typeof delta !== "object") throw new Error("INVALID_DELTA");
  if (delta.task_id !== snapshot.task_id) throw new Error("TASK_MISMATCH");
  if (delta.logical_attempt_id !== snapshot.logical_attempt_id) throw new Error("ATTEMPT_MISMATCH");
  if (delta.request_id !== snapshot.context_need?.request_id) throw new Error("REQUEST_MISMATCH");
  if (delta.expected_seq !== snapshot.context_seq) throw new Error(`STALE_SEQUENCE:${snapshot.context_seq}:${delta.expected_seq}`);
  if (snapshot.applied_delta_ids.includes(delta.delta_id)) throw new Error("DUPLICATE_DELTA");
  if (typeof delta.delta_id !== "string" || delta.delta_id.length === 0) throw new Error("delta.delta_id is required");
  if (!/^sha256:[0-9a-f]{64}$/.test(delta.delta_ref?.digest ?? "")) throw new Error("delta_ref.digest is invalid");
  if (typeof delta.delta_ref?.uri !== "string" || delta.delta_ref.uri.length === 0) throw new Error("delta_ref.uri is required");
}
export function isTerminal(state) { return TERMINAL.has(state); }
