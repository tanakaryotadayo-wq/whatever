export const TASK_QUEUES = Object.freeze({
  workflow: "akashic-workflow-v1",
  context: "akashic-context-v1",
  agent: "akashic-agent-v1",
  assurance: "akashic-assurance-v1"
});

export const taskQueue = TASK_QUEUES.workflow;

export function assertTaskQueueTopology(queues = TASK_QUEUES) {
  const requiredRoles = ["workflow", "context", "agent", "assurance"];
  for (const role of requiredRoles) {
    if (typeof queues?.[role] !== "string" || queues[role].length === 0) {
      throw new Error(`TASK_QUEUE_MISSING:${role}`);
    }
  }
  const values = requiredRoles.map((role) => queues[role]);
  if (new Set(values).size !== values.length) throw new Error("TASK_QUEUES_MUST_BE_DISTINCT");
  return Object.freeze({ ...queues });
}
