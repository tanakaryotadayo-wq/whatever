import { Context } from "@temporalio/activity";
import { assertAdoptable, claimEffect, completeEffect, makeAgentProvenance, makeVerificationReport } from "@akashic/contracts";
import { createHash } from "node:crypto";
import { link, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

function rootDir() { return resolve(process.env.AKASHIC_RUNTIME_ROOT || ".akashic-runtime"); }
function digestBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function immutableJson(kind, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  const hex = digestBytes(bytes);
  const path = join(rootDir(), "objects", hex.slice(0, 2), hex);
  await mkdir(dirname(path), { recursive: true });
  try { await stat(path); }
  catch {
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, bytes, { flag: "wx" });
    try { await link(temp, path); }
    catch (error) { if (error?.code !== "EEXIST") throw error; }
    finally { await rm(temp, { force: true }); }
  }
  return { media_type: "application/json", digest: `sha256:${hex}`, size: bytes.length, uri: `file://${path}`, artifact_type: kind };
}
async function readJsonRef(ref) {
  if (!ref?.uri?.startsWith("file://")) throw new Error("UNSUPPORTED_ARTIFACT_URI");
  const bytes = await readFile(fileURLToPath(ref.uri));
  const actual = `sha256:${digestBytes(bytes)}`;
  if (actual !== ref.digest) throw new Error("ARTIFACT_DIGEST_MISMATCH");
  if (bytes.length !== ref.size) throw new Error("ARTIFACT_SIZE_MISMATCH");
  return JSON.parse(bytes.toString("utf8"));
}
async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await rename(temp, path);
}
async function withFileLock(lockPath, operation, { timeoutMs = 10_000, staleMs = 30_000 } = {}) {
  const started = Date.now();
  await mkdir(dirname(lockPath), { recursive: true });
  let handle;
  for (;;) {
    try { handle = await open(lockPath, "wx"); break; }
    catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try { const info = await stat(lockPath); if (Date.now() - info.mtimeMs > staleMs) await rm(lockPath, { force: true }); }
      catch (statError) { if (statError?.code !== "ENOENT") throw statError; }
      if (Date.now() - started >= timeoutMs) throw new Error("EFFECT_LOCK_TIMEOUT");
      await sleep(25);
    }
  }
  try { return await operation(); }
  finally { await handle.close(); await rm(lockPath, { force: true }); }
}
function activityOwner() {
  const info = Context.current().info;
  return [info.workflowExecution?.workflowId, info.workflowExecution?.runId, info.activityId, info.attempt].filter(Boolean).join(":");
}

export async function compileContext({ task }) {
  Context.current().heartbeat({ stage: "compile", task_id: task.task_id });
  const compiled = { schema: "akashic.compiled-context/v1", task_id: task.task_id, refs: task.context_refs ?? [], recipient_seen_set: [], lineage: { parent_context_id: task.context_id, compiler: "fixture-v1" } };
  return { compiled_context_ref: await immutableJson("akashic.compiled-context/v1", compiled) };
}
export async function mergeContextDelta({ task_id, compiled_context_ref, context_delta_ref }) {
  Context.current().heartbeat({ stage: "merge", task_id });
  return { compiled_context_ref: await immutableJson("akashic.compiled-context/v1", { schema: "akashic.compiled-context/v1", task_id, parent: compiled_context_ref, applied_delta: context_delta_ref }) };
}
export async function runAgentTurn(input) {
  Context.current().heartbeat({ stage: "agent-turn", turn_no: input.turn_no });
  if (input.turn_no === 1 && !input.context_delta_ref) {
    return { outcome: "INPUT_REQUIRED", agent_session_id: `fixture:${input.task.task_id}`, context_need: { schema: "akashic.context-need/v1", request_id: `need:${input.task.task_id}:1`, task_id: input.task.task_id, logical_attempt_id: input.task.logical_attempt_id, expected_seq: 0, missing: ["fixture.required-context"], known_digests: (input.task.context_refs ?? []).map((ref) => ref.digest), max_tokens: 1024 } };
  }
  const candidate = { schema: "akashic.candidate/v1", task_id: input.task.task_id, logical_attempt_id: input.task.logical_attempt_id, turn_no: input.turn_no, goal: input.task.goal, acceptance: input.task.acceptance, context: input.compiled_context_ref };
  return { outcome: "COMPLETED", agent_session_id: `fixture:${input.task.task_id}`, compact_result: "fixture completed after context negotiation", candidate_artifact_refs: [await immutableJson("akashic.candidate/v1", candidate)], evidence_refs: [] };
}
export async function verifyCandidate({ task, candidate_artifact_refs }) {
  Context.current().heartbeat({ stage: "verify", task_id: task.task_id });
  const candidate = candidate_artifact_refs[0];
  if (!candidate) return { passed: false, verification_report_ref: null, provenance_ref: null };
  const completedAt = new Date().toISOString();
  const provenance = makeAgentProvenance({
    provenance_id: `prov:${task.task_id}:${task.logical_attempt_id}:${candidate.digest}`,
    source: { repository: process.env.AKASHIC_SOURCE_REPOSITORY || "tanakaryotadayo-wq/whatever", commit: process.env.AKASHIC_SOURCE_COMMIT || "fixture", tree: process.env.AKASHIC_SOURCE_TREE || null },
    run: { task_id: task.task_id, context_id: task.context_id, logical_attempt_id: task.logical_attempt_id },
    agent: { provider: "fixture", adapter_version: "v0.8", model: null, session_capability: "RECONSTRUCTIBLE_SESSION" },
    context_inputs: task.context_refs ?? [], outputs: candidate_artifact_refs, policy_ref: null,
    sandbox: { kind: "fixture", isolated: true }, evidence_refs: [], started_at: completedAt, completed_at: completedAt,
  });
  const checks = task.acceptance.map((criterion, index) => ({ check_id: `acceptance-${index + 1}`, kind: "acceptance", status: "PASS", required: true, evidence_refs: [candidate], summary: criterion }));
  const report = makeVerificationReport({ verification_id: `verify:${task.task_id}:${candidate.digest}`, subject_digest: candidate.digest, decision: "PASS", verifier: { id: "fixture-verifier", version: "v0.8" }, policy_version: "akashic.verification-policy/v1", checks, completed_at: completedAt });
  return { passed: true, verification_report_ref: await immutableJson("akashic.verification-report/v1", report), provenance_ref: await immutableJson("akashic.agent-provenance/v1", provenance) };
}
export async function adoptArtifact(input) {
  Context.current().heartbeat({ stage: "adopt", task_id: input.task_id });
  const verification = await readJsonRef(input.verification_report_ref);
  const provenance = await readJsonRef(input.provenance_ref);
  assertAdoptable({ candidate_ref: input.candidate_artifact_ref, verification_report: verification, provenance });
  const keyHex = digestBytes(Buffer.from(input.effect_key));
  const ledgerPath = join(rootDir(), "effects", keyHex.slice(0, 2), `${keyHex}.json`);
  return await withFileLock(`${ledgerPath}.lock`, async () => {
    let existing = null;
    try { existing = JSON.parse(await readFile(ledgerPath, "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    if (existing?.schema === "akashic.effect-ledger/v1" && existing.adoption_ref) {
      if (existing.candidate_artifact_ref?.digest !== input.candidate_artifact_ref.digest) throw new Error("EFFECT_CONFLICT");
      return { adoption_ref: existing.adoption_ref, idempotent_replay: true, generation: existing.expected_generation ?? 1 };
    }
    const owner = activityOwner();
    const claim = claimEffect(existing?.effect ?? null, { effect_key: input.effect_key, subject_digest: input.candidate_artifact_ref.digest, owner, takeover: existing?.effect != null });
    if (claim.status === "SUCCEEDED" && existing?.adoption_ref) return { adoption_ref: existing.adoption_ref, idempotent_replay: true, generation: claim.generation };
    await writeJsonAtomic(ledgerPath, { schema: "akashic.effect-ledger-entry/v2", effect: claim, candidate_artifact_ref: input.candidate_artifact_ref, verification_report_ref: input.verification_report_ref, provenance_ref: input.provenance_ref });
    const receipt = { schema: "akashic.adoption-receipt/v1", effect_key: input.effect_key, task_id: input.task_id, logical_attempt_id: input.logical_attempt_id, candidate_artifact_ref: input.candidate_artifact_ref, verification_report_ref: input.verification_report_ref, provenance_ref: input.provenance_ref, fence_generation: claim.generation };
    const adoptionRef = await immutableJson("akashic.adoption-receipt/v1", receipt);
    const completed = completeEffect(claim, { owner, generation: claim.generation, result_digest: adoptionRef.digest });
    await writeJsonAtomic(ledgerPath, { schema: "akashic.effect-ledger-entry/v2", effect: completed, candidate_artifact_ref: input.candidate_artifact_ref, verification_report_ref: input.verification_report_ref, provenance_ref: input.provenance_ref, adoption_ref: adoptionRef });
    return { adoption_ref: adoptionRef, idempotent_replay: completed.idempotent_replay, generation: completed.generation };
  });
}
