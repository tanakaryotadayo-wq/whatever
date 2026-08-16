import { requireString } from "@akashic/contracts/task-state";

function safeSegment(value, name) {
  return encodeURIComponent(requireString(value, name, 256));
}

export function taskOwnerToken(taskId) {
  return `akashic:task:v1:${safeSegment(taskId, "task_id")}`;
}

export function contextHookToken(snapshot) {
  if (!snapshot?.context_need) {
    throw new TypeError("context hook requires an INPUT_REQUIRED snapshot");
  }
  return [
    "akashic:context:v1",
    safeSegment(snapshot.task_id, "task_id"),
    safeSegment(snapshot.logical_attempt_id, "logical_attempt_id"),
    safeSegment(snapshot.context_need.request_id, "request_id"),
    String(snapshot.context_seq),
  ].join(":");
}
