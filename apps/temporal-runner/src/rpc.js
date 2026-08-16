import { WithStartWorkflowOperation } from "@temporalio/client";
import { sha256, validateTaskCapsule } from "@akashic/contracts";
import { applyContextDelta, getTaskSnapshot, requestCancel, submitTask, taskQueue as defaultTaskQueue } from "@akashic/temporal-workflow";

export function createRpcRouter({ client, taskQueue = defaultTaskQueue, operationFactory } = {}) {
  if (!client?.workflow) throw new Error("Temporal client is required");
  const makeOperation = operationFactory ?? ((workflowId) => new WithStartWorkflowOperation("runAgentTaskWorkflow", {
    workflowId, taskQueue, workflowIdConflictPolicy: "FAIL"
  }));
  return async function route(method, params = {}) {
    if (method === "tasks/send") {
      const original = validateTaskCapsule(params.task);
      const task = { ...original, execution_hash: original.execution_hash ?? `sha256:${sha256(original)}` };
      const start = makeOperation(task.task_id);
      const snapshot = await client.workflow.executeUpdateWithStart(submitTask, {
        startWorkflowOperation: start,
        args: [task],
        updateId: `submit:${task.task_id}:${task.execution_hash}`
      });
      const handle = await start.workflowHandle();
      return { ...snapshot, workflow_id: task.task_id, temporal_run_id: handle.firstExecutionRunId ?? null };
    }
    const taskId = params.id ?? params.task_id;
    if (typeof taskId !== "string" || taskId.length === 0) throw Object.assign(new Error("task id is required"), { code: "task_id_required" });
    const handle = client.workflow.getHandle(taskId);
    if (method === "tasks/get") return await handle.query(getTaskSnapshot);
    if (method === "tasks/update") {
      const delta = params.context_delta;
      return await handle.executeUpdate(applyContextDelta, { args: [delta], updateId: delta?.delta_id ?? `delta:${taskId}` });
    }
    if (method === "tasks/cancel") return await handle.executeUpdate(requestCancel, { args: [], updateId: `cancel:${taskId}` });
    throw Object.assign(new Error(`unsupported method: ${method}`), { code: "unsupported_method" });
  };
}
