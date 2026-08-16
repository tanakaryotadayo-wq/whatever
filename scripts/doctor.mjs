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
  "knowledge/packet-registry.json",
  "knowledge/PACKET_ADOPTION_MATRIX.md",
  "knowledge/external-adoption-policy.json",
  "knowledge/adoption-receipts/v0.9-rc1.json",
  "experiments/orchestrator-bakeoff/scenario.json",
  ".agents/skills/akashic-task-routing/SKILL.md",
  ".agents/skills/akashic-context-negotiation/SKILL.md",
  ".agents/skills/akashic-artifact-adoption/SKILL.md",
  ".agents/skills/akashic-orchestrator-bakeoff/SKILL.md",
  ".agents/skills/akashic-existing-first-adoption/SKILL.md",
];
for (const path of required) await access(path);
try {
  await access(".bootstrap-v07");
  throw new Error("obsolete .bootstrap-v07 directory must not exist");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const workspace = JSON.parse(await readFile("akashic.workspace.json", "utf8"));
if (workspace.schema !== "akashic.workspace/v1") {
  throw new Error("unexpected workspace schema");
}
if (workspace.source_authority?.provider !== "github") {
  throw new Error("GitHub must remain source authority");
}
const ledger = JSON.parse(await readFile("recovery/ASSET_LEDGER.json", "utf8"));
if (!Array.isArray(ledger.assets) || ledger.assets.length < 4) {
  throw new Error("asset ledger is incomplete");
}
console.log(
  JSON.stringify({
    ok: true,
    workspace: workspace.name,
    assets: ledger.assets.length,
    required_files: required.length,
    knowledge_packets: workspace.knowledge?.packet_count ?? null,
    workflow_candidates: ["temporal", "vercel-workflow", "cloudflare-workflows"],
  }),
);
