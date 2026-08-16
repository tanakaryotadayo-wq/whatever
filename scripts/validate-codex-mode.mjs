import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020Module from "ajv/dist/2020.js";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const read = (path) => readFile(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const mode = await read("docs/modes/CODEX_MODE.md");
const pointer = await read("docs/modes/CODEX_MODE_POINTER.md");
const state = JSON.parse(await read("docs/modes/CODEX_MODE_STATE.json"));
const handoff = JSON.parse(await read("docs/modes/CODEX_MODE_HANDOFF.json"));
const stateSchema = JSON.parse(await read("schemas/v1/codex-mode-state.schema.json"));
const handoffSchema = JSON.parse(await read("schemas/v1/codex-mode-handoff.schema.json"));
const skill = await read(".agents/skills/codex-mode/SKILL.md");
const manifest = JSON.parse(await read("docs/modes/MANIFEST_CODEX_MODE_20260816.json"));

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validateState = ajv.compile(stateSchema);
const validateHandoff = ajv.compile(handoffSchema);
assert.equal(validateState(state), true, JSON.stringify(validateState.errors, null, 2));
assert.equal(validateHandoff(handoff), true, JSON.stringify(validateHandoff.errors, null, 2));

assert.equal(state.mode_id, "codex-mode");
assert.equal(state.mode_version, "1.2.0");
assert.equal(state.activation_phrase, "codexモード起動");
assert.match(mode, /schema: akashic\.codex-mode\/v1\.2/);
assert.match(pointer, /schema: akashic\.mode-pointer\/v1\.2/);
assert.match(skill, /name: codex-mode/);

for (const phrase of [
  "codexモード起動",
  "codexモード 状態",
  "codexモード 続行",
  "codexモード 診断",
  "codexモード 証拠",
  "codexモード 計画",
  "codexモード 引継ぎ",
  "codexモード 終了",
]) {
  assert.ok(state.commands.some((command) => command.phrase === phrase), `missing command: ${phrase}`);
  assert.ok(mode.includes(phrase), `spec missing command: ${phrase}`);
}

for (const hook of ["on_activate", "pre_mutation", "post_mutation", "on_failure", "on_stop"]) {
  assert.ok(mode.includes(hook), `spec missing lifecycle hook: ${hook}`);
}
for (const layer of ["L0", "L1", "L1_5", "L2", "L3"]) assert.ok(state.read_layers[layer]);

assert.equal(state.source.main_head_relation, "ANCESTOR_OR_EQUAL");
assert.equal(state.integrity.main_head_comparison, "ANCESTOR_OR_EQUAL");
assert.ok(!Object.hasOwn(state.source, "observed_main_head"), "self-referential observed_main_head must not return");
assert.equal(state.source.provider_branch, "akashic/v0.10-codex-app-server-live");
assert.equal(state.source.provider_pull_request.number, 15);
assert.equal(state.source.provider_pull_request.draft, true);
assert.ok(state.provider_attempts.some((attempt) => attempt.status === "FAILED"));
assert.ok(state.provider_attempts.some((attempt) => attempt.status === "BLOCKED"));
assert.equal(state.status, "PROVIDER_ATTEMPTED_FAILED_AND_BLOCKED");
assert.equal(state.capabilities.valid_certification_receipt, false);
assert.notEqual(state.certification, "CERTIFIED");

assert.equal(handoff.projection, state.task_projection);
assert.equal(handoff.current_role, state.current_role);
assert.equal(handoff.source_snapshot.provider_branch, state.source.provider_branch);
assert.equal(handoff.work_packet.expected_heads.main_relation, "ANCESTOR_OR_EQUAL");
assert.ok(handoff.work_packet.do_not_repeat_without_change.length >= 3);
assert.equal(handoff.verification.adoption_allowed, false);
for (const field of handoff.executor_return_contract.required) assert.equal(typeof field, "string");

if (state.certification === "CERTIFIED") {
  assert.equal(state.status, "CERTIFIED");
  assert.equal(state.capabilities.valid_certification_receipt, true);
  const passes = state.provider_attempts.filter((attempt) => attempt.status === "PASS");
  assert.equal(passes.length, 3);
  const versions = new Set(passes.map((attempt) => attempt.codex_version).filter(Boolean));
  assert.equal(versions.size, 1);
  assert.ok(passes.every((attempt) => attempt.task_capsule_resent_on_turn_2 === false));
}

assert.ok(
  state.drive.misclassified_records.every((record) =>
    ["NO_RESULT", "EMPTY_NO_RESULT_CONTAINER"].includes(record.actual_status)
  ),
  "misclassified Drive records must remain explicitly quarantined",
);

assert.equal(manifest.schema, "akashic.codex-mode-manifest/v1.2");
const paths = new Set(manifest.files.map((entry) => entry.path));
for (const required of [
  "docs/modes/CODEX_MODE.md",
  "docs/modes/CODEX_MODE_POINTER.md",
  "docs/modes/CODEX_MODE_STATE.json",
  "docs/modes/CODEX_MODE_HANDOFF.json",
  "schemas/v1/codex-mode-state.schema.json",
  "schemas/v1/codex-mode-handoff.schema.json",
  "scripts/validate-codex-mode.mjs",
  "scripts/codex-mode-status.mjs",
  ".agents/skills/codex-mode/SKILL.md",
  ".github/agents/codex-mode.agent.md",
  "docs/ADR-0012-CODEX-MODE-UX.md",
  "docs/ADR-0013-CODEX-MODE-HANDOFF-STATE-INTEGRITY.md",
  "docs/AUDIT-2026-08-16.md",
  "docs/AUDIT-2026-08-16.json",
]) assert.ok(paths.has(required), `manifest missing ${required}`);

for (const entry of manifest.files) {
  const value = await read(entry.path);
  assert.equal(Buffer.byteLength(value), entry.bytes, `byte mismatch: ${entry.path}`);
  assert.equal(sha256(value), entry.sha256, `digest mismatch: ${entry.path}`);
}

assert.ok(pointer.length < 5_000, "Pointer must remain compact");

console.log(JSON.stringify({
  ok: true,
  mode_version: state.mode_version,
  status: state.status,
  certification: state.certification,
  commands: state.commands.length,
  provider_attempts: state.provider_attempts.length,
  manifest_files: manifest.files.length,
  handoff_id: handoff.handoff_id,
}));
