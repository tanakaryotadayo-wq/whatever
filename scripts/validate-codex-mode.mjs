import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020Module from "ajv/dist/2020.js";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const mode = await readFile("docs/modes/CODEX_MODE.md", "utf8");
const pointer = await readFile("docs/modes/CODEX_MODE_POINTER.md", "utf8");
const state = JSON.parse(await readFile("docs/modes/CODEX_MODE_STATE.json", "utf8"));
const schema = JSON.parse(await readFile("schemas/v1/codex-mode-state.schema.json", "utf8"));
const skill = await readFile(".agents/skills/codex-mode/SKILL.md", "utf8");

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validate = ajv.compile(schema);
assert.equal(validate(state), true, JSON.stringify(validate.errors, null, 2));

assert.equal(state.mode_id, "codex-mode");
assert.equal(state.activation_phrase, "codexモード起動");
assert.match(mode, /schema: akashic\.codex-mode\/v1\.1/);
assert.match(pointer, /schema: akashic\.mode-pointer\/v1\.1/);
assert.match(skill, /name: codex-mode/);

for (const phrase of [
  "codexモード起動",
  "codexモード 状態",
  "codexモード 続行",
  "codexモード 診断",
  "codexモード 証拠",
  "codexモード 計画",
  "codexモード 終了",
]) {
  assert.ok(state.commands.some((command) => command.phrase === phrase), `missing command: ${phrase}`);
  assert.ok(mode.includes(phrase), `spec missing command: ${phrase}`);
}

for (const hook of ["on_activate", "pre_mutation", "post_mutation", "on_failure", "on_stop"]) {
  assert.ok(mode.includes(hook), `spec missing lifecycle hook: ${hook}`);
}

for (const layer of ["L0", "L1", "L2", "L3"]) {
  assert.ok(state.read_layers[layer], `missing read layer: ${layer}`);
}

assert.ok(pointer.length < 5_000, "Pointer must remain a compact bootstrap");
assert.equal(state.source.provider_branch, "akashic/v0.10-codex-app-server-live");
assert.equal(state.source.provider_pull_request.number, 15);
assert.equal(state.source.provider_pull_request.draft, true);
assert.ok(state.provider_attempts.some((attempt) => attempt.status === "FAILED"));
assert.ok(state.provider_attempts.some((attempt) => attempt.status === "BLOCKED"));
assert.equal(state.status, "PROVIDER_ATTEMPTED_FAILED_AND_BLOCKED");
assert.equal(state.capabilities.valid_certification_receipt, false);
assert.notEqual(state.certification, "CERTIFIED");

if (state.certification === "CERTIFIED") {
  assert.equal(state.status, "CERTIFIED");
  assert.equal(state.capabilities.valid_certification_receipt, true);
  const passes = state.provider_attempts.filter((attempt) => attempt.status === "PASS");
  assert.equal(passes.length, 3, "CERTIFIED requires exactly three PASS attempts");
  const versions = new Set(passes.map((attempt) => attempt.codex_version).filter(Boolean));
  assert.equal(versions.size, 1, "CERTIFIED requires one Codex version");
  assert.ok(passes.every((attempt) => attempt.task_capsule_resent_on_turn_2 === false));
}

assert.ok(
  Array.isArray(state.drive.misclassified_records) &&
  state.drive.misclassified_records.every((record) =>
    ["NO_RESULT", "EMPTY_NO_RESULT_CONTAINER"].includes(record.actual_status)
  ),
  "misclassified Drive records must be explicitly quarantined",
);

console.log(JSON.stringify({
  ok: true,
  mode_id: state.mode_id,
  mode_version: state.mode_version,
  status: state.status,
  certification: state.certification,
  provider_attempts: state.provider_attempts.length,
  commands: state.commands.length,
}));
