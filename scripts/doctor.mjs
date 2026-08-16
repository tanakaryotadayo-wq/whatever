import { access, readFile } from "node:fs/promises";

const required = [
  "akashic.workspace.json",
  "AGENTS.md",
  "packages/contracts/package.json",
  "packages/contracts/src/task-state.js",
  "workflows/temporal/package.json",
  "apps/temporal-runner/package.json",
  "recovery/ASSET_LEDGER.json",
  "deploy/vercel-chatgpt-app/app/api/mcp/route.js",
  "deploy/vercel-chatgpt-app/workflows/run-agent-task.js",
  "deploy/vercel-chatgpt-app/next.config.mjs",
  "deploy/vercel-chatgpt-app/lib/codex-mode-gpt-actions.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/boot/route.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/status/route.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/evidence/route.js",
  "deploy/vercel-chatgpt-app/app/privacy/codex-mode/route.js",
  "deploy/vercel-chatgpt-app/public/codex-mode-openapi.json",
  "deploy/vercel-chatgpt-app/tests/codex-mode-gpt-actions.test.mjs",
  "knowledge/packet-registry.json",
  "knowledge/PACKET_ADOPTION_MATRIX.md",
  "knowledge/external-adoption-policy.json",
  "knowledge/adoption-receipts/v0.9-rc1.json",
  "knowledge/adoption-receipts/codex-mode-ux-v1.1.json",
  "knowledge/adoption-receipts/codex-mode-ux-v1.2.json",
  "knowledge/adoption-receipts/codex-mode-gpt-actions-v1.json",
  "experiments/orchestrator-bakeoff/scenario.json",
  ".agents/skills/akashic-task-routing/SKILL.md",
  ".agents/skills/akashic-context-negotiation/SKILL.md",
  ".agents/skills/akashic-artifact-adoption/SKILL.md",
  ".agents/skills/akashic-orchestrator-bakeoff/SKILL.md",
  ".agents/skills/akashic-existing-first-adoption/SKILL.md",
  ".agents/skills/codex-mode/SKILL.md",
  ".github/agents/codex-mode.agent.md",
  "docs/modes/CODEX_MODE.md",
  "docs/modes/CODEX_MODE_POINTER.md",
  "docs/modes/CODEX_MODE_STATE.json",
  "docs/modes/CODEX_MODE_HANDOFF.json",
  "docs/modes/MANIFEST_CODEX_MODE_20260816.json",
  "schemas/v1/codex-mode-state.schema.json",
  "schemas/v1/codex-mode-handoff.schema.json",
  "scripts/validate-codex-mode.mjs",
  "scripts/codex-mode-status.mjs",
  "scripts/validate-codex-mode-gpt.mjs",
  "gpts/codex-mode/README.md",
  "gpts/codex-mode/GPT_INSTRUCTIONS.md",
  "gpts/codex-mode/GPT_BUILDER_CONFIG.md",
  "gpts/codex-mode/KNOWLEDGE_INDEX.md",
  "gpts/codex-mode/PRIVACY_POLICY.md",
  "gpts/codex-mode/EVALS.jsonl",
  "gpts/codex-mode/GPT_PACKAGE.json",
  "gpts/codex-mode/PREVIEW_ACCEPTANCE.md",
  "gpts/codex-mode/openapi.json",
  "docs/ADR_INDEX.md",
  "docs/ADR-0012-CODEX-MODE-UX.md",
  "docs/ADR-0013-CODEX-MODE-HANDOFF-STATE-INTEGRITY.md",
  "docs/ADR-0014-CODEX-MODE-GPT-ACTIONS.md",
  "docs/AUDIT-2026-08-16.md",
  "docs/AUDIT-2026-08-16.json",
];
for (const path of required) await access(path);

for (const obsolete of [
  ".bootstrap-v07",
  "docs/ADR-0009-VERCEL-ACTIVE-RUN-IDEMPOTENCY.md",
  "docs/ADR-0010-EXISTING-FIRST-ADOPTION.md",
]) {
  try {
    await access(obsolete);
    throw new Error(`obsolete path must not exist: ${obsolete}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const workspace = JSON.parse(await readFile("akashic.workspace.json", "utf8"));
if (workspace.schema !== "akashic.workspace/v1") throw new Error("unexpected workspace schema");
if (workspace.source_authority?.provider !== "github") throw new Error("GitHub must remain source authority");

const ledger = JSON.parse(await readFile("recovery/ASSET_LEDGER.json", "utf8"));
if (!Array.isArray(ledger.assets) || ledger.assets.length < 4) throw new Error("asset ledger is incomplete");

const codexMode = JSON.parse(await readFile("docs/modes/CODEX_MODE_STATE.json", "utf8"));
if (codexMode.certification === "CERTIFIED" && codexMode.capabilities?.valid_certification_receipt !== true) {
  throw new Error("Codex mode cannot be CERTIFIED without a valid receipt");
}
if (codexMode.source?.main_head_relation !== "ANCESTOR_OR_EQUAL") {
  throw new Error("Codex mode State must use non-self-referential main head semantics");
}

console.log(JSON.stringify({
  ok: true,
  workspace: workspace.name,
  assets: ledger.assets.length,
  required_files: required.length,
  knowledge_packets: workspace.knowledge?.packet_count ?? null,
  workflow_candidates: ["temporal", "vercel-workflow", "cloudflare-workflows"],
  codex_mode: {
    version: codexMode.mode_version,
    status: codexMode.status,
    certification: codexMode.certification,
    role: codexMode.current_role,
    main_head_relation: codexMode.source.main_head_relation,
    gpt_actions_package: "codex-mode-gpt-actions-v1",
  },
}));
