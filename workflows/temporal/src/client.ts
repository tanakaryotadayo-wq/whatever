import { Client, Connection, WithStartWorkflowOperation } from '@temporalio/client';
import { submitTask, taskQueue } from './shared';
import type { TaskCapsule } from './types';
import { runAgentTask } from './workflows';

export async function submitWithStart(task: TaskCapsule, client?: Client) {
  const temporalClient = client ?? new Client({ connection: await Connection.connect() });
  const startWorkflowOperation = new WithStartWorkflowOperation(runAgentTask, {
    workflowId: task.task_id,
    taskQueue,
    args: [task],
    workflowIdConflictPolicy: 'USE_EXISTING' as any,
  });
  const snapshot = await temporalClient.workflow.executeUpdateWithStart(
    submitTask,
    {
      startWorkflowOperation,
      args: [task],
      updateId: task.idempotency_key,
    } as any,
  );
  return { snapshot, handle: await startWorkflowOperation.workflowHandle() };
}
