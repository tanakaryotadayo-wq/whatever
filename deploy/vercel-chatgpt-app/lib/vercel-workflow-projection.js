export const WORKFLOW_PROJECTION_EVENT_SCHEMA =
  "akashic.workflow-projection-event/v1";

export function snapshotProjection(snapshot) {
  return {
    schema: WORKFLOW_PROJECTION_EVENT_SCHEMA,
    kind: "TASK_SNAPSHOT",
    task_id: snapshot.task_id,
    state_seq: snapshot.state_seq,
    snapshot: structuredClone(snapshot),
  };
}

export function rejectionProjection(snapshot, error, delta) {
  return {
    schema: WORKFLOW_PROJECTION_EVENT_SCHEMA,
    kind: "CONTEXT_DELTA_REJECTED",
    task_id: snapshot.task_id,
    state_seq: snapshot.state_seq,
    context_seq: snapshot.context_seq,
    rejection: {
      code: typeof error?.code === "string" ? error.code : "INVALID_CONTEXT_DELTA",
      delta_id: typeof delta?.delta_id === "string" ? delta.delta_id : null,
      request_id: typeof delta?.request_id === "string" ? delta.request_id : null,
      expected_seq: Number.isSafeInteger(delta?.expected_seq)
        ? delta.expected_seq
        : null,
    },
  };
}

export async function readLatestSnapshotFromRun(run, { maxEvents = 128 } = {}) {
  if (!run || typeof run.getReadable !== "function") {
    throw new TypeError("run must provide getReadable()");
  }
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1 || maxEvents > 1024) {
    throw new TypeError("maxEvents must be an integer between 1 and 1024");
  }

  const probe = run.getReadable();
  const tail = await probe.getTailIndex();
  if (!Number.isSafeInteger(tail) || tail < 0) return null;

  const startIndex = Math.max(0, tail - maxEvents + 1);
  const readable = run.getReadable({ startIndex });
  const reader = readable.getReader();
  let latest = null;

  try {
    const expectedChunks = tail - startIndex + 1;
    for (let index = 0; index < expectedChunks; index += 1) {
      const { value, done } = await reader.read();
      if (done) break;
      if (
        value?.schema === WORKFLOW_PROJECTION_EVENT_SCHEMA &&
        value.kind === "TASK_SNAPSHOT" &&
        value.snapshot
      ) {
        latest = structuredClone(value.snapshot);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed after the requested historical range.
    }
    try {
      reader.releaseLock();
    } catch {
      // Ignore an already released reader.
    }
  }

  return latest;
}

export function synthesizeSnapshotForRunStatus(snapshot, status, runId) {
  const base = snapshot
    ? structuredClone(snapshot)
    : {
        schema: "akashic.task-snapshot/v1",
        task_id: null,
        context_id: null,
        logical_attempt_id: null,
        state: "SUBMITTED",
        terminal: false,
        state_seq: 0,
        context_seq: 0,
        turn_no: 0,
        context_need: null,
        candidate_artifact_refs: [],
        verification_report_ref: null,
        provenance_ref: null,
        adoption_ref: null,
        applied_delta_ids: [],
        error: null,
      };

  base.vercel_run_id = runId;
  base.workflow_backend = "vercel-workflow";

  if (status === "cancelled" && !base.terminal) {
    return {
      ...base,
      state: "CANCELED",
      terminal: true,
      state_seq: base.state_seq + 1,
      error: { code: "VERCEL_RUN_CANCELED", retryable: false },
    };
  }
  if (status === "failed" && !base.terminal) {
    return {
      ...base,
      state: "FAILED",
      terminal: true,
      state_seq: base.state_seq + 1,
      error: { code: "VERCEL_RUN_FAILED", retryable: false },
    };
  }
  return base;
}
