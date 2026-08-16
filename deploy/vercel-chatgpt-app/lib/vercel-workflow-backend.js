import {
  getHookByToken,
  getRun,
  resumeHook,
  start,
} from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import {
  canonicalJson,
  sha256,
} from "@akashic/contracts";
import {
  validateContextDelta,
  validateTaskCapsule,
} from "@akashic/contracts/task-state";
import { runAgentTaskOnVercel } from "../workflows/run-agent-task.js";
import {
  contextHookToken,
  taskOwnerToken,
} from "./vercel-workflow-ids.js";
import {
  readLatestSnapshotFromRun,
  synthesizeSnapshotForRunStatus,
} from "./vercel-workflow-projection.js";

function codedError(code, message, status = 400, details = undefined) {
  return Object.assign(new Error(message), { code, status, details });
}

function isHookNotFound(error) {
  return HookNotFoundError.is(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeTaskForVercel(taskInput) {
  const source = structuredClone(taskInput);
  if (!source.execution_hash) {
    const hashInput = structuredClone(source);
    delete hashInput.execution_hash;
    source.execution_hash = `sha256:${sha256(canonicalJson(hashInput))}`;
  }
  return validateTaskCapsule(source);
}

export async function lookupTaskOwner(taskId) {
  try {
    return await getHookByToken(taskOwnerToken(taskId));
  } catch (error) {
    if (isHookNotFound(error)) return null;
    throw error;
  }
}

async function waitForTaskOwner(taskId, { attempts = 50, delayMs = 100 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const owner = await lookupTaskOwner(taskId);
    if (owner) return owner;
    await sleep(delayMs);
  }
  return null;
}

async function waitForFirstSnapshot(run, { attempts = 50, delayMs = 100 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const snapshot = await readLatestSnapshotFromRun(run);
    if (snapshot) return snapshot;
    const status = await run.status;
    if (["completed", "failed", "cancelled"].includes(status)) break;
    await sleep(delayMs);
  }
  return null;
}

function assertSameSubmission(snapshot, task) {
  if (!snapshot) return;
  if (
    snapshot.task_id !== task.task_id ||
    snapshot.logical_attempt_id !== task.logical_attempt_id ||
    snapshot.submission_digest !== task.execution_hash
  ) {
    throw codedError(
      "TASK_CONFLICT",
      "task_id is already owned by a different submission",
      409,
      {
        existing_task_id: snapshot.task_id,
        existing_logical_attempt_id: snapshot.logical_attempt_id,
        existing_submission_digest: snapshot.submission_digest,
        requested_logical_attempt_id: task.logical_attempt_id,
        requested_submission_digest: task.execution_hash,
      },
    );
  }
}

export async function startVercelWorkflow(taskInput) {
  const task = normalizeTaskForVercel(taskInput);
  const existingOwner = await lookupTaskOwner(task.task_id);
  if (existingOwner) {
    const existingRun = getRun(existingOwner.runId);
    const snapshot = await waitForFirstSnapshot(existingRun);
    assertSameSubmission(snapshot, task);
    return {
      backend: "vercel-workflow",
      task_id: task.task_id,
      logical_attempt_id: task.logical_attempt_id,
      submission_digest: task.execution_hash,
      run_id: existingOwner.runId,
      accepted: true,
      idempotent_replay: true,
      owner_registration: "existing",
      snapshot,
    };
  }

  const created = await start(runAgentTaskOnVercel, [task]);
  const owner = await waitForTaskOwner(task.task_id);
  const runId = owner?.runId ?? created.runId;
  const activeRun = getRun(runId);
  const snapshot = await waitForFirstSnapshot(activeRun);
  assertSameSubmission(snapshot, task);

  return {
    backend: "vercel-workflow",
    task_id: task.task_id,
    logical_attempt_id: task.logical_attempt_id,
    submission_digest: task.execution_hash,
    run_id: runId,
    created_run_id: created.runId,
    accepted: true,
    idempotent_replay: runId !== created.runId,
    owner_registration: owner ? "confirmed" : "pending",
    snapshot,
  };
}

export async function getVercelWorkflow(runId) {
  if (typeof runId !== "string" || runId.length === 0) {
    throw codedError("INVALID_RUN_ID", "run_id is required");
  }
  const run = getRun(runId);
  const status = await run.status;
  let snapshot = await readLatestSnapshotFromRun(run);
  let returnValue = null;

  if (status === "completed") {
    returnValue = await run.returnValue;
    if (returnValue?.schema === "akashic.task-snapshot/v1") {
      snapshot = returnValue;
    }
  }

  return {
    backend: "vercel-workflow",
    run_id: runId,
    run_status: status,
    snapshot: synthesizeSnapshotForRunStatus(snapshot, status, runId),
    duplicate:
      returnValue?.schema === "akashic.workflow-duplicate/v1"
        ? returnValue
        : null,
  };
}

export async function applyContextDeltaToVercelWorkflow(runId, deltaInput) {
  const current = await getVercelWorkflow(runId);
  const snapshot = current.snapshot;
  const delta = validateContextDelta(snapshot, deltaInput);
  const token = contextHookToken(snapshot);

  let hook;
  try {
    hook = await getHookByToken(token);
  } catch (error) {
    if (isHookNotFound(error)) {
      throw codedError(
        "CONTEXT_HOOK_NOT_READY",
        "workflow has not registered its context hook",
        409,
      );
    }
    throw error;
  }
  if (hook.runId !== runId) {
    throw codedError(
      "CONTEXT_HOOK_OWNER_MISMATCH",
      "context hook belongs to another workflow run",
      409,
    );
  }

  const resumed = await resumeHook(token, delta);
  if (resumed.runId !== runId) {
    throw codedError(
      "CONTEXT_RESUME_OWNER_MISMATCH",
      "context delta resumed a different workflow run",
      409,
    );
  }

  return {
    backend: "vercel-workflow",
    run_id: runId,
    task_id: snapshot.task_id,
    logical_attempt_id: snapshot.logical_attempt_id,
    delta_id: delta.delta_id,
    accepted: true,
    expected_applied_context_seq: snapshot.context_seq + 1,
  };
}

export async function cancelVercelWorkflow(runId) {
  if (typeof runId !== "string" || runId.length === 0) {
    throw codedError("INVALID_RUN_ID", "run_id is required");
  }
  const run = getRun(runId);
  await run.cancel();
  return {
    backend: "vercel-workflow",
    run_id: runId,
    cancellation_requested: true,
  };
}
