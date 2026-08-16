#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareLiveProtocol,
  runSingleCertification,
  writeCertificationReceipt,
} from "../packages/codex-app-server-adapter/src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repoRoot, "fixtures", "codex-live-two-turn");
const evidenceRoot = path.join(repoRoot, "evidence", "codex-live-two-turn");
const generatedRoot = path.join(
  repoRoot,
  "packages",
  "codex-app-server-adapter",
  "generated",
);
const command = [process.env.CODEX_BIN || "codex"];
const runsRequired = Number(process.env.CODEX_LIVE_RUNS || 3);

if (process.env.AKASHIC_CODEX_LIVE !== "1") {
  console.error("AKASHIC_CODEX_LIVE=1 is required for official provider execution");
  process.exit(77);
}
if (runsRequired !== 3) {
  console.error("Live certification requires exactly three consecutive runs");
  process.exit(2);
}

await mkdir(evidenceRoot, { recursive: true });
const protocol = await prepareLiveProtocol({ command, generatedRoot });
const runs = [];
let failure = null;
for (let iteration = 1; iteration <= runsRequired; iteration += 1) {
  try {
    const run = await runSingleCertification({
      command,
      fixtureRoot,
      evidenceRoot,
      protocol,
      iteration,
    });
    runs.push(run);
    console.log(JSON.stringify({
      status: "PASS",
      iteration,
      run_id: run.manifest.run_id,
      thread_id: run.manifest.thread_id,
      model: run.manifest.model,
      reasoning_effort: run.manifest.reasoning_effort,
      evidence_dir: path.relative(repoRoot, run.evidenceDir),
    }));
  } catch (error) {
    if (error?.details?.manifest) {
      runs.push({
        evidenceDir: error.details.evidenceDir,
        manifest: error.details.manifest,
      });
    }
    failure = error;
    break;
  }
}

const { receipt, receiptPath } = await writeCertificationReceipt({
  evidenceRoot,
  protocol,
  runs,
});
console.log(JSON.stringify({
  status: receipt.status,
  codex_version: receipt.codex_version,
  protocol_schema_sha256: receipt.protocol_schema_sha256,
  consecutive_passes: receipt.consecutive_passes,
  receipt: path.relative(repoRoot, receiptPath),
}));

if (failure || receipt.status !== "CERTIFIED") {
  console.error(failure?.stack || failure?.message || "Codex live certification failed");
  process.exit(1);
}
