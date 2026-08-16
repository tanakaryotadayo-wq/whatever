import {
  createHook,
  getStepMetadata,
  getWorkflowMetadata,
  getWritable,
} from "workflow";
import {
  TERMINAL_STATES,
  validateContextDelta,
  validateTaskCapsule,
  validateTransition,
} from "@akashic/contracts/task-state";
import {
  contextHookToken,
  taskOwnerToken,
} from "../lib/vercel-workflow-ids.js";
import {
  rejectionProjection,
  snapshotProjection,
} from "../lib/vercel-workflow-projection.js";

function clone(value) {
  return structuredClone(value);
}

export function initialVercelSnapshot(task, runId = null) {
  const validated = validateTaskCapsule(task);
  return {
    schema: "akashic.task-snapshot/v1",
    task_id: validated.task_id,
    context_id: validated.context_id,
    logical_attempt_id: validated.logical_attempt_id,
    submission_digest: validated.execution_hash ?? null,
    vercel_run_id: runId,
    workflow_backend: "vercel-workflow",
    agent_session_id: null,
    state: "SUBMITTED",
    terminal: false,
    state_seq: 1,
    context_seq: 0,
    turn_no: 0,
    context_need: null,
    compiled_context_ref: null,
    last_context_delta_ref: null,
    candidate_artifact_refs: [],
    verification_report_ref: null,
    provenance_ref: null,
    adoption_ref: null,
    applied_delta_ids: [],
    error: null,
  };
}

export function transitionVercelSnapshot(snapshot, to, patch = {}) {
  if (TERMINAL_STATES.has(snapshot.state)) return clone(snapshot);
  validateTransition(snapshot.state, to);
  return {
    ...clone(snapshot),
    ...clone(patch),
    state: to,
    terminal: TERMINAL_STATES.has(to),
    state_seq: snapshot.state_seq + 1,
  };
}

export function applyContextDeltaToVercelSnapshot(snapshot, delta) {
  const validated = validateContextDelta(snapshot, delta);
  validateTransition(snapshot.state, "WORKING");
  return {
    ...clone(snapshot),
    state: "WORKING",
    terminal: false,
    state_seq: snapshot.state_seq + 1,
    context_seq: snapshot.context_seq + 1,
    context_need: null,
    last_context_delta_ref: clone(validated.delta_ref),
    applied_delta_ids: [...(snapshot.applied_delta_ids ?? []), validated.delta_id],
  };
}

async function emitProjectionStep(event) {
  "use step";
  const writer = getWritable().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function fixtureArtifactRef(kind, value) {
  const [{ createHash }, { canonicalJson }] = await Promise.all([
    import("node:crypto"),
    import("@akashic/contracts"),
  ]);
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  const hex = createHash("sha256").update(bytes).digest("hex");
  return {
    media_type: "application/json",
    digest: `sha256:${hex}`,
    size: bytes.length,
    uri: `fixture+vercel://sha256/${hex}`,
    artifact_type: kind,
  };
}

async function compileContextStep({ task }) {
  "use step";
  console.log(`[compileContext] START task=${task.task_id}`);
  const compiled = {
    schema: "akashic.compiled-context/v1",
    task_id: task.task_id,
    refs: task.context_refs ?? [],
    recipient_seen_set: [],
    lineage: {
      parent_context_id: task.context_id,
      compiler: "vercel-workflow-fixture-v1",
    },
  };
  const compiled_context_ref = await fixtureArtifactRef(
    "akashic.compiled-context/v1",
    compiled,
  );
  console.log(`[compileContext] DONE task=${task.task_id}`);
  return { compiled_context_ref };
}

async function mergeContextDeltaStep({
  task_id,
  compiled_context_ref,
  context_delta_ref,
  idempotency_key,
}) {
  "use step";
  console.log(`[mergeContextDelta] START task=${task_id} key=${idempotency_key}`);
  const merged_context_ref = await fixtureArtifactRef(
    "akashic.compiled-context/v1",
    {
      schema: "akashic.compiled-context/v1",
      task_id,
      parent: compiled_context_ref,
      applied_delta: context_delta_ref,
      idempotency_key,
    },
  );
  console.log(`[mergeContextDelta] DONE task=${task_id}`);
  return { compiled_context_ref: merged_context_ref };
}

async function runAgentTurnStep(input) {
  "use step";
  console.log(
    `[runAgentTurn] START task=${input.task.task_id} turn=${input.turn_no}`,
  );
  if (input.turn_no === 1 && !input.context_delta_ref) {
    return {
      outcome: "INPUT_REQUIRED",
      agent_session_id: `fixture:vercel:${input.task.task_id}`,
      context_need: {
        schema: "akashic.context-need/v1",
        request_id: `need:${input.task.task_id}:1`,
        task_id: input.task.task_id,
        logical_attempt_id: input.task.logical_attempt_id,
        expected_seq: input.context_seq,
        missing: ["fixture.required-context"],
        known_digests: (input.task.context_refs ?? []).map((ref) => ref.digest),
        max_tokens: 1024,
      },
    };
  }

  const candidate = {
    schema: "akashic.candidate/v1",
    task_id: input.task.task_id,
    logical_attempt_id: input.task.logical_attempt_id,
    turn_no: input.turn_no,
    acceptance_count: input.task.acceptance.length,
    compiled_context_ref: input.compiled_context_ref,
  };
  const candidateRef = await fixtureArtifactRef(
    "akashic.candidate/v1",
    candidate,
  );
  console.log(
    `[runAgentTurn] DONE task=${input.task.task_id} turn=${input.turn_no}`,
  );
  return {
    outcome: "COMPLETED",
    agent_session_id: `fixture:vercel:${input.task.task_id}`,
    compact_result: "fixture completed after context negotiation",
    candidate_artifact_refs: [candidateRef],
    evidence_refs: [],
  };
}

async function verifyCandidateStep({ task, candidate_artifact_refs }) {
  "use step";
  console.log(`[verifyCandidate] START task=${task.task_id}`);
  const candidate = candidate_artifact_refs[0];
  if (!candidate) {
    return {
      passed: false,
      verification_report_ref: null,
      provenance_ref: null,
      adoption_material: null,
    };
  }

  const { makeAgentProvenance, makeVerificationReport } = await import(
    "@akashic/contracts"
  );
  const completedAt = new Date().toISOString();
  const provenance = makeAgentProvenance({
    provenance_id: `prov:${task.task_id}:${task.logical_attempt_id}:${candidate.digest}`,
    source: {
      repository:
        process.env.AKASHIC_SOURCE_REPOSITORY ?? "tanakaryotadayo-wq/whatever",
      commit: process.env.AKASHIC_SOURCE_COMMIT ?? "vercel-workflow-fixture",
      tree: process.env.AKASHIC_SOURCE_TREE ?? null,
    },
    run: {
      task_id: task.task_id,
      context_id: task.context_id,
      logical_attempt_id: task.logical_attempt_id,
    },
    agent: {
      provider: "fixture",
      adapter_version: "vercel-workflow-v0.9",
      model: null,
      session_capability: "RECONSTRUCTIBLE_SESSION",
    },
    context_inputs: task.context_refs ?? [],
    outputs: candidate_artifact_refs,
    policy_ref: null,
    sandbox: { kind: "vercel-workflow-fixture", isolated: true },
    evidence_refs: [],
    started_at: completedAt,
    completed_at: completedAt,
  });
  const checks = task.acceptance.map((criterion, index) => ({
    check_id: `acceptance-${index + 1}`,
    kind: "acceptance",
    status: "PASS",
    required: true,
    evidence_refs: [candidate],
    summary: criterion,
  }));
  const verificationReport = makeVerificationReport({
    verification_id: `verify:${task.task_id}:${candidate.digest}`,
    subject_digest: candidate.digest,
    decision: "PASS",
    verifier: { id: "vercel-workflow-fixture-verifier", version: "v0.9" },
    policy_version: "akashic.verification-policy/v1",
    checks,
    completed_at: completedAt,
  });
  const [verification_report_ref, provenance_ref] = await Promise.all([
    fixtureArtifactRef(
      "akashic.verification-report/v1",
      verificationReport,
    ),
    fixtureArtifactRef("akashic.agent-provenance/v1", provenance),
  ]);
  console.log(`[verifyCandidate] DONE task=${task.task_id}`);
  return {
    passed: true,
    verification_report_ref,
    provenance_ref,
    adoption_material: {
      verification_report: verificationReport,
      provenance,
    },
  };
}

async function adoptArtifactStep(input) {
  "use step";
  console.log(`[adoptArtifact] START task=${input.task_id}`);
  const {
    assertAdoptable,
    claimEffect,
    completeEffect,
    makeEffectKey,
  } = await import("@akashic/contracts");
  assertAdoptable({
    candidate_ref: input.candidate_artifact_ref,
    verification_report: input.adoption_material.verification_report,
    provenance: input.adoption_material.provenance,
  });

  const { stepId } = getStepMetadata();
  const effectKey = makeEffectKey({
    task_id: input.task_id,
    logical_attempt_id: input.logical_attempt_id,
    turn_no: input.turn_no,
    operation: "adopt",
    subject_digest: input.candidate_artifact_ref.digest,
  });
  const owner = `vercel-step:${stepId}`;
  const claim = claimEffect(null, {
    effect_key: effectKey,
    subject_digest: input.candidate_artifact_ref.digest,
    owner,
  });
  const receipt = {
    schema: "akashic.adoption-receipt/v1",
    effect_key: effectKey,
    task_id: input.task_id,
    logical_attempt_id: input.logical_attempt_id,
    candidate_artifact_ref: input.candidate_artifact_ref,
    verification_report_ref: input.verification_report_ref,
    provenance_ref: input.provenance_ref,
    fence_generation: claim.generation,
    workflow_step_id: stepId,
  };
  const adoption_ref = await fixtureArtifactRef(
    "akashic.adoption-receipt/v1",
    receipt,
  );
  const completed = completeEffect(claim, {
    owner,
    generation: claim.generation,
    result_digest: adoption_ref.digest,
  });
  console.log(`[adoptArtifact] DONE task=${input.task_id}`);
  return {
    adoption_ref,
    effect_key: effectKey,
    generation: completed.generation,
    idempotency_key: stepId,
  };
}

export async function runAgentTaskOnVercel(taskInput) {
  "use workflow";

  const task = validateTaskCapsule(taskInput);
  const metadata = getWorkflowMetadata();
  const owner = createHook({ token: taskOwnerToken(task.task_id) });

  try {
    const conflict = await owner.getConflict();
    if (conflict) {
      return {
        schema: "akashic.workflow-duplicate/v1",
        task_id: task.task_id,
        logical_attempt_id: task.logical_attempt_id,
        submission_digest: task.execution_hash ?? null,
        duplicate_of_run_id: conflict.runId,
      };
    }

    let snapshot = initialVercelSnapshot(task, metadata.workflowRunId);
    await emitProjectionStep(snapshotProjection(snapshot));

    try {
      snapshot = transitionVercelSnapshot(snapshot, "COMPILING_CONTEXT");
      await emitProjectionStep(snapshotProjection(snapshot));
      const compiled = await compileContextStep({ task });
      snapshot = {
        ...snapshot,
        compiled_context_ref: clone(compiled.compiled_context_ref),
      };

      for (;;) {
        const turnNo = snapshot.turn_no + 1;
        snapshot = transitionVercelSnapshot(snapshot, "WORKING", {
          turn_no: turnNo,
        });
        await emitProjectionStep(snapshotProjection(snapshot));

        const output = await runAgentTurnStep({
          task,
          turn_no: turnNo,
          context_seq: snapshot.context_seq,
          compiled_context_ref: snapshot.compiled_context_ref,
          context_delta_ref: snapshot.last_context_delta_ref,
          idempotency_key: `${task.task_id}:${task.logical_attempt_id}:${turnNo}`,
        });

        if (output.outcome === "INPUT_REQUIRED") {
          snapshot = transitionVercelSnapshot(snapshot, "INPUT_REQUIRED", {
            context_need: clone(output.context_need),
            agent_session_id:
              output.agent_session_id ?? snapshot.agent_session_id,
          });
          await emitProjectionStep(snapshotProjection(snapshot));

          const contextHook = createHook({ token: contextHookToken(snapshot) });
          try {
            const contextConflict = await contextHook.getConflict();
            if (contextConflict) {
              throw new Error(
                `CONTEXT_HOOK_CONFLICT:${contextConflict.runId}`,
              );
            }

            let acceptedDelta = null;
            for await (const candidateDelta of contextHook) {
              try {
                const next = applyContextDeltaToVercelSnapshot(
                  snapshot,
                  candidateDelta,
                );
                acceptedDelta = clone(candidateDelta);
                snapshot = next;
                await emitProjectionStep(snapshotProjection(snapshot));
                break;
              } catch (error) {
                await emitProjectionStep(
                  rejectionProjection(snapshot, error, candidateDelta),
                );
              }
            }

            if (!acceptedDelta) {
              throw new Error("CONTEXT_HOOK_CLOSED_WITHOUT_VALID_DELTA");
            }
            const merged = await mergeContextDeltaStep({
              task_id: task.task_id,
              compiled_context_ref: snapshot.compiled_context_ref,
              context_delta_ref: acceptedDelta.delta_ref,
              idempotency_key: `merge:${acceptedDelta.delta_id}`,
            });
            snapshot = {
              ...snapshot,
              compiled_context_ref: clone(merged.compiled_context_ref),
            };
          } finally {
            contextHook.dispose();
          }
          continue;
        }

        if (output.outcome === "FAILED") {
          snapshot = transitionVercelSnapshot(snapshot, "FAILED", {
            error: clone(
              output.error ?? { code: "AGENT_FAILED", retryable: false },
            ),
          });
          await emitProjectionStep(snapshotProjection(snapshot));
          return snapshot;
        }

        if (
          output.outcome !== "COMPLETED" ||
          !Array.isArray(output.candidate_artifact_refs) ||
          output.candidate_artifact_refs.length === 0
        ) {
          throw new Error("AGENT_INVALID_TERMINAL_OUTPUT");
        }

        snapshot = transitionVercelSnapshot(snapshot, "VERIFYING", {
          candidate_artifact_refs: clone(output.candidate_artifact_refs),
          agent_session_id:
            output.agent_session_id ?? snapshot.agent_session_id,
          compact_result: output.compact_result ?? null,
        });
        await emitProjectionStep(snapshotProjection(snapshot));

        const verification = await verifyCandidateStep({
          task,
          candidate_artifact_refs: snapshot.candidate_artifact_refs,
        });
        snapshot = {
          ...snapshot,
          verification_report_ref: clone(
            verification.verification_report_ref,
          ),
          provenance_ref: clone(verification.provenance_ref),
        };
        if (!verification.passed) {
          snapshot = transitionVercelSnapshot(snapshot, "FAILED", {
            error: { code: "VERIFICATION_FAILED", retryable: false },
          });
          await emitProjectionStep(snapshotProjection(snapshot));
          return snapshot;
        }

        snapshot = transitionVercelSnapshot(snapshot, "ADOPTING");
        await emitProjectionStep(snapshotProjection(snapshot));
        const adoption = await adoptArtifactStep({
          task_id: task.task_id,
          logical_attempt_id: task.logical_attempt_id,
          turn_no: snapshot.turn_no,
          candidate_artifact_ref: snapshot.candidate_artifact_refs[0],
          verification_report_ref: snapshot.verification_report_ref,
          provenance_ref: snapshot.provenance_ref,
          adoption_material: verification.adoption_material,
        });
        snapshot = transitionVercelSnapshot(snapshot, "COMPLETED", {
          adoption_ref: clone(adoption.adoption_ref),
          effect: {
            effect_key: adoption.effect_key,
            generation: adoption.generation,
            idempotency_key: adoption.idempotency_key,
          },
        });
        await emitProjectionStep(snapshotProjection(snapshot));
        return snapshot;
      }
    } catch (error) {
      if (!TERMINAL_STATES.has(snapshot.state)) {
        snapshot = transitionVercelSnapshot(snapshot, "FAILED", {
          error: {
            code:
              typeof error?.code === "string"
                ? error.code
                : "VERCEL_WORKFLOW_FAILED",
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        });
        await emitProjectionStep(snapshotProjection(snapshot));
      }
      return snapshot;
    }
  } finally {
    owner.dispose();
  }
}
