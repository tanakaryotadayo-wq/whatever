import {
  CancellationScope,
  condition,
  isCancellation,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import type { Activities } from './activities';
import { applyContextDelta, cancelTask, getTask, submitTask } from './shared';
import type { ArtifactRef, ContextDelta, Snapshot, TaskCapsule } from './types';

const activities = proxyActivities<Activities>({
  startToCloseTimeout: '5 minutes',
  heartbeatTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

export async function runAgentTask(task: TaskCapsule): Promise<Snapshot> {
  let snapshot: Snapshot = {
    schema: 'akashic.task-snapshot/v1',
    task_id: task.task_id,
    temporal_run_id: null,
    logical_attempt_id: task.logical_attempt_id,
    activity_attempt: null,
    agent_session_id: null,
    request_id: null,
    context_seq: 0,
    turn_no: 0,
    state: 'SUBMITTED',
    terminal: false,
    artifact_refs: [],
    error: null,
  };
  let deltaRef: ArtifactRef | null = null;
  let cancelled = false;
  let activeScope: CancellationScope | undefined;

  setHandler(getTask, () => snapshot);
  setHandler(submitTask, (incoming) => {
    if (incoming.task_id !== task.task_id || incoming.idempotency_key !== task.idempotency_key) {
      throw new Error('task_conflict');
    }
    return snapshot;
  });
  setHandler(
    applyContextDelta,
    (delta: ContextDelta) => {
      deltaRef = delta.delta_ref;
      snapshot = {
        ...snapshot,
        context_seq: snapshot.context_seq + 1,
        request_id: null,
        state: 'WORKING',
      };
      return { accepted: true, applied_seq: snapshot.context_seq, state: 'WORKING' };
    },
    {
      validator: (delta: ContextDelta) => {
        if (snapshot.state !== 'INPUT_REQUIRED') throw new Error('NOT_WAITING_FOR_CONTEXT');
        if (delta.task_id !== snapshot.task_id) throw new Error('WRONG_TASK');
        if (delta.logical_attempt_id !== snapshot.logical_attempt_id) throw new Error('WRONG_ATTEMPT');
        if (delta.request_id !== snapshot.request_id) throw new Error('WRONG_REQUEST');
        if (delta.expected_seq !== snapshot.context_seq) throw new Error('STALE_SEQUENCE');
      },
    },
  );
  setHandler(cancelTask, () => {
    cancelled = true;
    activeScope?.cancel();
    snapshot = { ...snapshot, state: 'CANCELED', terminal: true, error: { code: 'canceled' } };
    return snapshot;
  });

  try {
    snapshot = { ...snapshot, state: 'COMPILING_CONTEXT' };
    const compiledContext = await activities.compileContext(task);
    if (cancelled) return snapshot;

    while (!cancelled) {
      snapshot = { ...snapshot, state: 'WORKING', turn_no: snapshot.turn_no + 1 };
      activeScope = new CancellationScope();
      const output = await activeScope.run(() =>
        activities.runAgentTurn({
          task_id: task.task_id,
          logical_attempt_id: task.logical_attempt_id,
          turn_no: snapshot.turn_no,
          agent: task.agent,
          agent_session_id: snapshot.agent_session_id,
          task_capsule: task,
          compiled_context_ref: compiledContext,
          context_delta_ref: deltaRef,
          idempotency_key: `${task.task_id}:${task.logical_attempt_id}:${snapshot.turn_no}`,
        }),
      );
      activeScope = undefined;
      snapshot = { ...snapshot, agent_session_id: output.agent_session_id };

      if (output.outcome === 'INPUT_REQUIRED') {
        snapshot = {
          ...snapshot,
          state: 'INPUT_REQUIRED',
          request_id: output.context_need.request_id,
        };
        await condition(() => snapshot.state !== 'INPUT_REQUIRED' || cancelled);
        continue;
      }
      if (output.outcome === 'FAILED') {
        return {
          ...snapshot,
          state: 'FAILED',
          terminal: true,
          error: { code: output.failure_code, retryable: output.retryable },
        };
      }

      snapshot = { ...snapshot, state: 'VERIFYING' };
      const adopted: ArtifactRef[] = [];
      for (const candidate of output.candidate_artifact_refs) {
        const verification = await activities.verifyCandidate(candidate, task);
        if (verification.verdict !== 'PASS') {
          return {
            ...snapshot,
            state: 'FAILED',
            terminal: true,
            error: { code: 'verification_failed' },
          };
        }
        snapshot = { ...snapshot, state: 'ADOPTING' };
        adopted.push(
          await activities.adoptArtifact(
            candidate,
            verification,
            `${task.task_id}:${task.logical_attempt_id}:${candidate.digest}`,
          ),
        );
      }
      return {
        ...snapshot,
        state: 'COMPLETED',
        terminal: true,
        artifact_refs: adopted,
      };
    }
    return snapshot;
  } catch (error) {
    if (isCancellation(error) || cancelled) {
      return {
        ...snapshot,
        state: 'CANCELED',
        terminal: true,
        error: { code: 'canceled' },
      };
    }
    throw error;
  }
}
