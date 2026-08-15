import { access, readFile } from "node:fs/promises";

const required = [
  "akashic.workspace.json",
  "AGENTS.md",
  "packages/contracts/package.json",
  "workflows/temporal/package.json",
  "apps/temporal-runner/package.json",
  "recovery/ASSET_LEDGER.json",
  "deploy/vercel-chatgpt-app/app/api/mcp/route.js"
];
for (const path of required) await access(path);
const workspace = JSON.parse(await readFile("akashic.workspace.json", "utf8"));
if (workspace.schema !== "akashic.workspace/v1") throw new Error("unexpected workspace schema");
const ledger = JSON.parse(await readFile("recovery/ASSET_LEDGER.json", "utf8"));
if (!Array.isArray(ledger.assets) || ledger.assets.length < 4) throw new Error("asset ledger is incomplete");
console.log(JSON.stringify({ ok: true, workspace: workspace.name, assets: ledger.assets.length, required_files: required.length }));
