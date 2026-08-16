import { CancellationScope, condition, isCancellation, proxyActivities, setHandler } from "@temporalio/workflow";
import { applyContextDelta, getTaskSnapshot, requestCancel, submitTask } from "./shared.js";
import { TASK_QUEUES } from "./task-queues.js";
import { assertDeltaAllowed, assertTask, clone, isTerminal } from "./workflow-contracts.js";

const retry = { initialInterval: "1 second", maximumInterval: "10 seconds", maximumAttempts: 3 };
const contextActivities = proxyActivities({
  taskQueue: TASK_QUEUES.context,
  startToCloseTimeout: "2 minutes",
  scheduleToCloseTimeout: "10 minutes",
  heartbeatTimeout: "20 seconds",
  retry
});
const agentActivities = proxyActivities({
  taskQueue: TASK_QUEUES.agent,
  startToCloseTimeout: "30 minutes",
  scheduleToCloseTimeout: "45 minutes",
  heartbeatTimeout: "20 seconds",
  retry
});
const assuranceActivities = proxyActivities({
  taskQueue: TASK_QUEUES.assurance,
  startToCloseTimeout: "10 minutes",
  scheduleToCloseTimeout: "15 minutes",
  heartbeatTimeout: "20 seconds",
  retry
});

function initialSnapshot() {
  return {
    schema: "akashic.task-snapshot/v1",
    initialized: false,
    task_id: null,
    context_id: null,
    logical_attempt_id: null,
    temporal_run_id: null,
    agent_session_id: null,
    state: "SUBMITTED",
    terminal: false,
    state_seq: 0,
    context_seq: 0,
    turn_no: 0,
    task: null,
    context_need: null,
    compiled_context_ref: null,
    last_context_delta_ref: null,
    candidate_artifact_refs: [],
    verification_report_ref: null,
    provenance_ref: null,
    adoption_ref: null,
    applied_delta_ids: [],
    error: null
  };
}

export async function runAgentTaskWorkflow() {
  let snapshot = initialSnapshot();
  let pendingDelta = null;
  let cancelRequested = false;
  const expose = () => clone(snapshot);
  const transition = (to, patch = {}) => {
    if (isTerminal(snapshot.state)) return;
    snapshot = { ...snapshot, ...clone(patch), state: to, terminal: isTerminal(to), state_seq: snapshot.state_seq + 1 };
  };

  setHandler(getTaskSnapshot, expose);
  setHandler(
    submitTask,
    (task) => {
      if (snapshot.initialized) return expose();
      snapshot = {
        ...snapshot,
        initialized: true,
        task_id: task.task_id,
        context_id: task.context_id,
        logical_attempt_id: task.logical_attempt_id,
        task: clone(task),
        state: "SUBMITTED",
        state_seq: 1
      };
      return expose();
    },
    {
      validator: (task) => {
        assertTask(task);
        if (snapshot.initialized && snapshot.task.execution_hash !== task.execution_hash) throw new Error("TASK_CONFLICT");
      }
    }
  );
  setHandler(
    applyContextDelta,
    (delta) => {
      pendingDelta = clone(delta);
      snapshot = {
        ...snapshot,
        state: "WORKING",
        state_seq: snapshot.state_seq + 1,
        context_seq: snapshot.context_seq + 1,
        context_need: null,
        last_context_delta_ref: clone(delta.delta_ref),
        applied_delta_ids: [...snapshot.applied_delta_ids, delta.delta_id]
      };
      return expose();
    },
    { validator: (delta) => assertDeltaAllowed(snapshot, delta) }
  );
  setHandler(requestCancel, () => {
    cancelRequested = true;
    if (!isTerminal(snapshot.state)) transition("CANCELED", { error: { code: "CANCELED_BY_REQUEST", retryable: false } });
    return expose();
  });

  await condition(() => snapshot.initialized || cancelRequested);
  if (cancelRequested) return expose();

  try {
    transition("COMPILING_CONTEXT");
    const compiled = await contextActivities.compileContext({ task: snapshot.task });
    snapshot = { ...snapshot, compiled_context_ref: clone(compiled.compiled_context_ref) };

    for (;;) {
      if (cancelRequested) return expose();
      const turnNo = snapshot.turn_no + 1;
      transition("WORKING", { turn_no: turnNo });
      const output = await CancellationScope.cancellable(() =>
        agentActivities.runAgentTurn({
          task: snapshot.task,
          turn_no: turnNo,
          compiled_context_ref: snapshot.compiled_context_ref,
          context_delta_ref: snapshot.last_context_delta_ref,
          idempotency_key: `${snapshot.task_id}:${snapshot.logical_attempt_id}:${turnNo}`
        })
      );

      if (output.outcome === "INPUT_REQUIRED") {
        transition("INPUT_REQUIRED", {
          context_need: clone(output.context_need),
          agent_session_id: output.agent_session_id ?? snapshot.agent_session_id
        });
        await condition(() => pendingDelta !== null || cancelRequested);
        if (cancelRequested) return expose();
        const delta = pendingDelta;
        pendingDelta = null;
        const merged = await contextActivities.mergeContextDelta({
          task_id: snapshot.task_id,
          compiled_context_ref: snapshot.compiled_context_ref,
          context_delta_ref: delta.delta_ref,
          idempotency_key: `merge:${delta.delta_id}`
        });
        snapshot = { ...snapshot, compiled_context_ref: clone(merged.compiled_context_ref) };
        continue;
      }

      if (output.outcome === "FAILED") {
        transition("FAILED", { error: clone(output.error ?? { code: "AGENT_FAILED", retryable: false }) });
        return expose();
      }
      if (output.outcome !== "COMPLETED" || !Array.isArray(output.candidate_artifact_refs) || output.candidate_artifact_refs.length === 0) {
        throw new Error("agent returned an invalid terminal output");
      }

      transition("VERIFYING", {
        candidate_artifact_refs: clone(output.candidate_artifact_refs),
        agent_session_id: output.agent_session_id ?? snapshot.agent_session_id
      });
      const verification = await assuranceActivities.verifyCandidate({
        task: snapshot.task,
        candidate_artifact_refs: snapshot.candidate_artifact_refs,
        idempotency_key: `verify:${snapshot.task_id}:${snapshot.logical_attempt_id}`
      });
      snapshot = {
        ...snapshot,
        verification_report_ref: clone(verification.verification_report_ref),
        provenance_ref: clone(verification.provenance_ref)
      };
      if (!verification.passed) {
        transition("FAILED", { error: { code: "VERIFICATION_FAILED", retryable: false } });
        return expose();
      }

      transition("ADOPTING");
      const adoption = await assuranceActivities.adoptArtifact({
        task_id: snapshot.task_id,
        logical_attempt_id: snapshot.logical_attempt_id,
        turn_no: snapshot.turn_no,
        candidate_artifact_ref: snapshot.candidate_artifact_refs[0],
        verification_report_ref: snapshot.verification_report_ref,
        provenance_ref: snapshot.provenance_ref,
        expected_generation: 0,
        effect_key: `adopt:${snapshot.task_id}:${snapshot.logical_attempt_id}:${snapshot.candidate_artifact_refs[0].digest}`
      });
      transition("COMPLETED", { adoption_ref: clone(adoption.adoption_ref) });
      return expose();
    }
  } catch (error) {
    if (isCancellation(error)) {
      transition("CANCELED", { error: { code: "TEMPORAL_CANCELED", retryable: false } });
      return expose();
    }
    transition("FAILED", {
      error: { code: "WORKFLOW_FAILED", message: error instanceof Error ? error.message : String(error), retryable: false }
    });
    return expose();
  }
}
