import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function sha256File(path) {
  const bytes = await readFile(path);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function walk(root) {
  const output = [];
  for (const name of (await readdir(root)).sort()) {
    const path = join(root, name);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

const schemaFiles = (await walk("schemas/v1")).filter((path) => path.endsWith(".schema.json"));
const evidence = {
  schema: "akashic.ci-evidence/v1",
  commit: process.env.AKASHIC_CI_COMMIT ?? null,
  run_id: process.env.AKASHIC_CI_RUN_ID ?? null,
  run_attempt: process.env.AKASHIC_CI_RUN_ATTEMPT ?? null,
  ref: process.env.AKASHIC_CI_REF ?? null,
  generated_at: new Date().toISOString(),
  node: process.version,
  locked_dependency_graph: await sha256File("package-lock.json"),
  packet_registry: await sha256File("knowledge/packet-registry.json"),
  schema_count: schemaFiles.length,
  schema_digests: Object.fromEntries(await Promise.all(schemaFiles.map(async (path) => [path, await sha256File(path)]))),
  gates: [
    "npm_ci",
    "dependency_audit_high",
    "doctor",
    "schemas",
    "knowledge",
    "core",
    "temporal_p0",
    "vercel_gateway",
    "cloudflare_conformance"
  ]
};
await mkdir("evidence/ci", { recursive: true });
await writeFile("evidence/ci/manifest.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, evidence: "evidence/ci/manifest.json", schema_count: schemaFiles.length }));
