import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppServerHelp, getCodexVersion, generateProtocolSchemas } from "./process-manager.js";
import { safeVersion, writeJson } from "./evidence.js";
export { runSingleCertification } from "./run-certification.js";

export async function prepareLiveProtocol({ command, generatedRoot }) {
  const codexVersion = await getCodexVersion(command);
  const versionRoot = path.join(generatedRoot, safeVersion(codexVersion));
  const schemaRoot = path.join(versionRoot, "schema");
  await mkdir(versionRoot, { recursive: true });
  const help = await getAppServerHelp(command);
  await writeFile(
    path.join(versionRoot, "app-server-help.txt"),
    `${help.stdout}${help.stderr}`,
    "utf8",
  );
  const schemaManifest = await generateProtocolSchemas(command, schemaRoot, {
    codexVersion,
  });
  return { codexVersion, versionRoot, schemaRoot, schemaManifest };
}

export async function writeCertificationReceipt({ evidenceRoot, protocol, runs }) {
  const receipt = {
    schema: "akashic.codex-app-server-certification-receipt/v1",
    status: runs.length === 3 && runs.every((run) => run.manifest.status === "PASS")
      ? "CERTIFIED"
      : "FAILED",
    codex_version: protocol.codexVersion,
    protocol_schema_sha256: protocol.schemaManifest.protocol_schema_sha256,
    consecutive_passes: runs.filter((run) => run.manifest.status === "PASS").length,
    required_consecutive_passes: 3,
    run_ids: runs.map((run) => run.manifest.run_id),
    thread_ids: runs.map((run) => run.manifest.thread_id),
    created_at: new Date().toISOString(),
  };
  const receiptPath = path.join(evidenceRoot, "certification-receipt.json");
  await writeJson(receiptPath, receipt);
  return { receipt, receiptPath };
}
