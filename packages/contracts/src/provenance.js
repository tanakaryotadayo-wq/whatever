function requireString(value, name) { if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`); return value; }
function requireDigest(value, name) { if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new TypeError(`${name} must be sha256:<64 lowercase hex>`); return value; }
function digestOf(ref, name) { if (!ref || typeof ref !== "object" || Array.isArray(ref)) throw new TypeError(`${name} must be an ArtifactRef`); return requireDigest(ref.digest, `${name}.digest`); }
export function makeAgentProvenance(input) {
  const outputs = input?.outputs ?? []; if (!Array.isArray(outputs) || outputs.length === 0) throw new TypeError("provenance requires outputs"); outputs.forEach((ref, index) => digestOf(ref, `outputs[${index}]`));
  const contextInputs = input.context_inputs ?? []; if (!Array.isArray(contextInputs)) throw new TypeError("context_inputs must be an array"); contextInputs.forEach((ref, index) => digestOf(ref, `context_inputs[${index}]`));
  return { schema: "akashic.agent-provenance/v1", provenance_id: requireString(input.provenance_id, "provenance_id"), subject_digests: outputs.map((ref) => ref.digest), source: { repository: requireString(input.source?.repository, "source.repository"), commit: requireString(input.source?.commit, "source.commit"), tree: input.source?.tree ?? null }, run: { task_id: requireString(input.run?.task_id, "run.task_id"), context_id: requireString(input.run?.context_id, "run.context_id"), logical_attempt_id: requireString(input.run?.logical_attempt_id, "run.logical_attempt_id"), turn_no: input.run?.turn_no }, agent: { provider: requireString(input.agent?.provider, "agent.provider"), adapter_version: requireString(input.agent?.adapter_version, "agent.adapter_version"), model: input.agent?.model ?? null, session_capability: input.agent?.session_capability ?? null }, context_inputs: structuredClone(contextInputs), outputs: structuredClone(outputs), policy_ref: input.policy_ref ? structuredClone(input.policy_ref) : null, sandbox: structuredClone(input.sandbox ?? null), evidence_refs: structuredClone(input.evidence_refs ?? []), started_at: requireString(input.started_at, "started_at"), completed_at: requireString(input.completed_at, "completed_at") };
}
export function makeVerificationReport(input) {
  const decision = input?.decision; if (!["PASS", "FAIL", "INCONCLUSIVE"].includes(decision)) throw new TypeError("verification decision must be PASS, FAIL, or INCONCLUSIVE"); requireDigest(input.subject_digest, "subject_digest");
  if (!Array.isArray(input.checks) || input.checks.length === 0) throw new TypeError("verification report requires checks");
  const checks = input.checks.map((check, index) => { if (!["PASS", "FAIL", "INCONCLUSIVE"].includes(check.status)) throw new TypeError(`checks[${index}].status is invalid`); return { check_id: requireString(check.check_id, `checks[${index}].check_id`), kind: requireString(check.kind, `checks[${index}].kind`), status: check.status, required: check.required !== false, evidence_refs: structuredClone(check.evidence_refs ?? []), summary: check.summary ?? null }; });
  if (decision === "PASS" && checks.filter((check) => check.required).some((check) => check.status !== "PASS")) throw new TypeError("PASS report contains a non-PASS required check");
  return { schema: "akashic.verification-report/v1", verification_id: requireString(input.verification_id, "verification_id"), subject_digest: input.subject_digest, decision, verifier: { id: requireString(input.verifier?.id, "verifier.id"), version: requireString(input.verifier?.version, "verifier.version") }, policy_version: requireString(input.policy_version, "policy_version"), checks, completed_at: requireString(input.completed_at, "completed_at") };
}
export function assertAdoptable({ candidate_ref, verification_report, provenance }) {
  const subjectDigest = digestOf(candidate_ref, "candidate_ref");
  if (verification_report?.schema !== "akashic.verification-report/v1") throw new TypeError("unsupported verification report");
  if (verification_report.decision !== "PASS") throw new Error("VERIFICATION_NOT_PASS");
  if (verification_report.subject_digest !== subjectDigest) throw new Error("VERIFICATION_SUBJECT_MISMATCH");
  if (provenance?.schema !== "akashic.agent-provenance/v1") throw new TypeError("unsupported provenance");
  if (!provenance.subject_digests?.includes(subjectDigest)) throw new Error("PROVENANCE_SUBJECT_MISMATCH");
  return { subject_digest: subjectDigest, verification_id: verification_report.verification_id, provenance_id: provenance.provenance_id };
}
