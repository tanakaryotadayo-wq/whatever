import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export const manifestPath = "docs/modes/MANIFEST_CODEX_MODE_20260816.json";
export const manifestFiles = [
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
];

const digest = (value) =>
  createHash("sha256").update(value).digest("hex");

export async function buildManifest() {
  const files = [];
  for (const path of manifestFiles) {
    const value = await readFile(path);
    files.push({
      path,
      sha256: digest(value),
      bytes: value.byteLength,
    });
  }
  return {
    schema: "akashic.codex-mode-manifest/v1.2",
    mode_id: "codex-mode",
    mode_version: "1.2.0",
    digest_algorithm: "sha256",
    files,
  };
}

export function serializeManifest(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const generated = serializeManifest(await buildManifest());
  if (process.argv.includes("--check")) {
    const current = await readFile(manifestPath, "utf8").catch(() => "");
    if (current !== generated) {
      console.error(`${manifestPath} is stale; run node scripts/regenerate-codex-mode-manifest.mjs`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ ok: true, manifest: manifestPath, files: manifestFiles.length }));
    return;
  }
  await writeFile(manifestPath, generated, "utf8");
  console.log(JSON.stringify({ ok: true, manifest: manifestPath, files: manifestFiles.length }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
