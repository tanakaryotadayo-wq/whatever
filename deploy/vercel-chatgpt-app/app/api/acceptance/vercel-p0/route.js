import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import {
  applyContextDeltaToVercelWorkflow,
  getVercelWorkflow,
  startVercelWorkflow,
} from "../../../../lib/vercel-workflow-backend.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function equalSecret(actual, expected) {
  const left = Buffer.from(actual ?? "");
  const right = Buffer.from(expected ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireAcceptanceAccess(request) {
  if (process.env.AKASHIC_LIVE_ACCEPTANCE_ENABLED !== "true") {
    throw Object.assign(new Error("live acceptance is disabled"), {
      code: "acceptance_disabled",
      status: 404,
    });
  }
  const expected = process.env.AKASHIC_LIVE_ACCEPTANCE_TOKEN;
  if (!expected) {
    throw Object.assign(new Error("live acceptance token is not configured"), {
      code: "acceptance_not_configured",
      status: 503,
    });
  }
  const actual = new URL(request.url).searchParams.get("token") ?? "";
  if (!equalSecret(actual, expected)) {
    throw Object.assign(new Error("unauthorized"), {
      code: "unauthorized",
      status: 401,
    });
  }
}

function jsonError(error) {
  return Response.json(
    {
      ok: false,
      error: {
        code: typeof error?.code === "string" ? error.code : "acceptance_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    },
    { status: Number.isInteger(error?.status) ? error.status : 500 },
  );
}

async function waitForState(runId, predicate, { attempts = 120, delayMs = 250 } = {}) {
  let latest = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await getVercelWorkflow(runId);
    if (predicate(latest)) return { ...latest, poll_attempts: attempt };
    await sleep(delayMs);
  }
  throw Object.assign(new Error("workflow state polling timed out"), {
    code: "acceptance_poll_timeout",
    details: latest,
  });
}

async function applyWhenHookReady(runId, delta, { attempts = 80, delayMs = 250 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await applyContextDeltaToVercelWorkflow(runId, delta);
      return { ...result, hook_attempts: attempt };
    } catch (error) {
      lastError = error;
      if (error?.code !== "CONTEXT_HOOK_NOT_READY") throw error;
      await sleep(delayMs);
    }
  }
  throw lastError ?? Object.assign(new Error("context hook did not become ready"), {
    code: "context_hook_timeout",
  });
}

function makeDeltaRef(taskId) {
  const body = Buffer.from(`vercel-live-context:${taskId}`, "utf8");
  const digest = createHash("sha256").update(body).digest("hex");
  return {
    media_type: "text/plain",
    digest: `sha256:${digest}`,
    size: body.length,
    uri: `acceptance+vercel://sha256/${digest}`,
    artifact_type: "akashic.context-delta/v1",
  };
}

export async function GET(request) {
  const startedAt = new Date().toISOString();
  try {
    requireAcceptanceAccess(request);
    const nonce = randomUUID();
    const task = {
      schema: "akashic.task-capsule/v1",
      task_id: `vercel-live-${nonce}`,
      context_id: `ctx-${nonce}`,
      logical_attempt_id: `attempt-${nonce}`,
      goal: "Prove the live Vercel Workflow RunAgentTask context-negotiation slice.",
      acceptance: [
        "turn 1 reaches INPUT_REQUIRED",
        "a stale ContextPacketDelta is rejected",
        "a valid ContextPacketDelta resumes the same run",
        "turn 2 reaches COMPLETED with verification and adoption evidence",
      ],
      context_refs: [],
    };

    const submission = await startVercelWorkflow(task);
    const runId = submission.run_id;
    const waiting = await waitForState(
      runId,
      (value) => value?.snapshot?.state === "INPUT_REQUIRED",
    );
    const snapshot = waiting.snapshot;
    const deltaRef = makeDeltaRef(task.task_id);

    const staleDelta = {
      delta_id: `stale-${nonce}`,
      task_id: task.task_id,
      request_id: snapshot.context_need.request_id,
      logical_attempt_id: task.logical_attempt_id,
      expected_seq: snapshot.context_seq + 1,
      delta_ref: deltaRef,
    };
    let staleRejection = null;
    try {
      await applyContextDeltaToVercelWorkflow(runId, staleDelta);
      throw Object.assign(new Error("stale delta was unexpectedly accepted"), {
        code: "stale_delta_accepted",
      });
    } catch (error) {
      if (error?.code === "stale_delta_accepted") throw error;
      staleRejection = {
        code: error?.code ?? error?.name ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
      };
      if (staleRejection.code !== "STALE_SEQUENCE") {
        throw Object.assign(new Error("stale delta failed for the wrong reason"), {
          code: "wrong_stale_rejection",
          details: staleRejection,
        });
      }
    }

    const validDelta = {
      ...staleDelta,
      delta_id: `valid-${nonce}`,
      expected_seq: snapshot.context_seq,
    };
    const activeReplay = await startVercelWorkflow(task);
    const resume = await applyWhenHookReady(runId, validDelta);
    const terminal = await waitForState(
      runId,
      (value) => ["COMPLETED", "FAILED", "CANCELED"].includes(value?.snapshot?.state),
    );
    const finalSnapshot = terminal.snapshot;

    const checks = {
      input_required: snapshot.state === "INPUT_REQUIRED",
      stale_rejected: staleRejection.code === "STALE_SEQUENCE",
      valid_delta_accepted: resume.accepted === true,
      same_run_resumed: resume.run_id === runId,
      completed: finalSnapshot.state === "COMPLETED",
      context_seq_advanced: finalSnapshot.context_seq === snapshot.context_seq + 1,
      two_turns: finalSnapshot.turn_no === 2,
      verification_present: Boolean(finalSnapshot.verification_report_ref),
      provenance_present: Boolean(finalSnapshot.provenance_ref),
      adoption_present: Boolean(finalSnapshot.adoption_ref),
      active_duplicate_submit_idempotent:
        activeReplay.idempotent_replay === true && activeReplay.run_id === runId,
    };
    const passed = Object.values(checks).every(Boolean);
    const completedAt = new Date().toISOString();

    return Response.json(
      {
        ok: passed,
        schema: "akashic.live-acceptance-evidence/v1",
        backend: "vercel-workflow",
        sdk: "workflow@4.6.0",
        source_commit: process.env.AKASHIC_SOURCE_COMMIT ?? null,
        started_at: startedAt,
        completed_at: completedAt,
        task_id: task.task_id,
        logical_attempt_id: task.logical_attempt_id,
        run_id: runId,
        checks,
        evidence: {
          submission,
          waiting: {
            poll_attempts: waiting.poll_attempts,
            state: snapshot.state,
            state_seq: snapshot.state_seq,
            context_seq: snapshot.context_seq,
            request_id: snapshot.context_need.request_id,
          },
          stale_rejection: staleRejection,
          resume,
          terminal: {
            poll_attempts: terminal.poll_attempts,
            snapshot: finalSnapshot,
          },
          active_replay: {
            run_id: activeReplay.run_id,
            idempotent_replay: activeReplay.idempotent_replay,
            owner_registration: activeReplay.owner_registration,
          },
        },
      },
      { status: passed ? 200 : 500 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
