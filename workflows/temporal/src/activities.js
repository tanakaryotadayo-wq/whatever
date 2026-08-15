import { Context } from "@temporalio/activity";
import { createHash } from "node:crypto";
import { link, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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

export async function compileContext({ task }) {
  Context.current().heartbeat({ stage: "compile", task_id: task.task_id });
  const compiled = {
    schema: "akashic.compiled-context/v1", task_id: task.task_id, refs: task.context_refs ?? [],
    recipient_seen_set: [], lineage: { parent_context_id: task.context_id, compiler: "fixture-v1" }
  };
  return { compiled_context_ref: await immutableJson("akashic.compiled-context/v1", compiled) };
}
export async function mergeContextDelta({ task_id, compiled_context_ref, context_delta_ref }) {
  Context.current().heartbeat({ stage: "merge", task_id });
  return { compiled_context_ref: await immutableJson("akashic.compiled-context/v1", {
    schema: "akashic.compiled-context/v1", task_id, parent: compiled_context_ref, applied_delta: context_delta_ref
  }) };
}
export async function runAgentTurn(input) {
  Context.current().heartbeat({ stage: "agent-turn", turn_no: input.turn_no });
  if (input.turn_no === 1 && !input.context_delta_ref) {
    return {
      outcome: "INPUT_REQUIRED", agent_session_id: `fixture:${input.task.task_id}`,
      context_need: {
        schema: "akashic.context-need/v1", request_id: `need:${input.task.task_id}:1`,
        task_id: input.task.task_id, logical_attempt_id: input.task.logical_attempt_id,
        expected_seq: 0, missing: ["fixture.required-context"],
        known_digests: (input.task.context_refs ?? []).map((ref) => ref.digest), max_tokens: 1024
      }
    };
  }
  const candidate = {
    schema: "akashic.candidate/v1", task_id: input.task.task_id,
    logical_attempt_id: input.task.logical_attempt_id, turn_no: input.turn_no,
    goal: input.task.goal, acceptance: input.task.acceptance, context: input.compiled_context_ref
  };
  return {
    outcome: "COMPLETED", agent_session_id: `fixture:${input.task.task_id}`,
    compact_result: "fixture completed after context negotiation",
    candidate_artifact_refs: [await immutableJson("akashic.candidate/v1", candidate)], evidence_refs: []
  };
}
export async function verifyCandidate({ task, candidate_artifact_refs }) {
  Context.current().heartbeat({ stage: "verify", task_id: task.task_id });
  const passed = candidate_artifact_refs.length > 0 && task.acceptance.length > 0;
  const report = {
    schema: "akashic.verification-report/v1", task_id: task.task_id,
    verifier: { id: "fixture-verifier", version: "1" }, passed,
    candidate_digests: candidate_artifact_refs.map((ref) => ref.digest),
    checks: task.acceptance.map((criterion) => ({ criterion, passed }))
  };
  return { passed, verification_report_ref: await immutableJson("akashic.verification-report/v1", report) };
}
export async function adoptArtifact(input) {
  Context.current().heartbeat({ stage: "adopt", task_id: input.task_id });
  const keyHex = digestBytes(Buffer.from(input.effect_key));
  const ledgerPath = join(rootDir(), "effects", keyHex.slice(0, 2), `${keyHex}.json`);
  await mkdir(dirname(ledgerPath), { recursive: true });
  try {
    const existing = JSON.parse(await readFile(ledgerPath, "utf8"));
    if (existing.candidate_artifact_ref.digest !== input.candidate_artifact_ref.digest) throw new Error("EFFECT_CONFLICT");
    return { adoption_ref: existing.adoption_ref, idempotent_replay: true };
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const record = {
    schema: "akashic.effect-ledger/v1", effect_key: input.effect_key, task_id: input.task_id,
    logical_attempt_id: input.logical_attempt_id, expected_generation: input.expected_generation,
    candidate_artifact_ref: input.candidate_artifact_ref, verification_report_ref: input.verification_report_ref
  };
  const adoptionRef = await immutableJson("akashic.adoption-receipt/v1", record);
  const complete = { ...record, adoption_ref: adoptionRef };
  const temp = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(complete, null, 2) + "\n", { flag: "wx" });
  try { await link(temp, ledgerPath); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = JSON.parse(await readFile(ledgerPath, "utf8"));
    if (existing.candidate_artifact_ref.digest !== input.candidate_artifact_ref.digest) throw new Error("EFFECT_CONFLICT");
    return { adoption_ref: existing.adoption_ref, idempotent_replay: true };
  } finally { await rm(temp, { force: true }); }
  return { adoption_ref: adoptionRef, idempotent_replay: false };
}
