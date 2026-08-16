import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function normalizeCommand(command) {
  if (Array.isArray(command) && command.length > 0) return command.map(String);
  if (typeof command === "string" && command.trim()) return [command.trim()];
  return [process.env.CODEX_BIN || "codex"];
}

export async function runCommand(command, args, {
  cwd,
  env = process.env,
  timeoutMs = 60_000,
  allowFailure = false,
} = {}) {
  const [file, ...prefix] = normalizeCommand(command);
  const child = spawn(file, [...prefix, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`command timed out: ${[file, ...prefix, ...args].join(" ")}`);
      error.code = "CODEX_COMMAND_TIMEOUT";
      reject(error);
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
  if (!allowFailure && result.code !== 0) {
    const error = new Error(`command failed (${result.code}): ${[file, ...prefix, ...args].join(" ")}`);
    error.code = "CODEX_COMMAND_FAILED";
    error.details = result;
    throw error;
  }
  return result;
}

export async function getCodexVersion(command) {
  const result = await runCommand(command, ["--version"]);
  const value = result.stdout.trim() || result.stderr.trim();
  if (!value) throw new Error("codex --version returned no version");
  return value;
}

export async function getAppServerHelp(command) {
  return runCommand(command, ["app-server", "--help"]);
}

async function walkFiles(root, current = root) {
  const names = await readdir(current);
  const files = [];
  for (const name of names.sort()) {
    const full = path.join(current, name);
    const info = await stat(full);
    if (info.isDirectory()) files.push(...await walkFiles(root, full));
    else if (info.isFile()) files.push(full);
  }
  return files;
}

export async function hashDirectory(root) {
  const files = await walkFiles(root);
  const manifest = [];
  const aggregate = createHash("sha256");
  for (const full of files) {
    const relative = path.relative(root, full).split(path.sep).join("/");
    const bytes = await readFile(full);
    const digest = createHash("sha256").update(bytes).digest("hex");
    manifest.push({ path: relative, sha256: `sha256:${digest}`, size: bytes.length });
    aggregate.update(relative).update("\0").update(digest).update("\0");
  }
  return {
    files: manifest,
    digest: `sha256:${aggregate.digest("hex")}`,
  };
}

export async function generateProtocolSchemas(command, outDir, { codexVersion } = {}) {
  await rm(outDir, { recursive: true, force: true });
  const jsonDir = path.join(outDir, "json-schema");
  const tsDir = path.join(outDir, "typescript");
  await mkdir(jsonDir, { recursive: true });
  await mkdir(tsDir, { recursive: true });
  await runCommand(command, ["app-server", "generate-json-schema", "--out", jsonDir], {
    timeoutMs: 120_000,
  });
  await runCommand(command, ["app-server", "generate-ts", "--out", tsDir], {
    timeoutMs: 120_000,
  });
  const tree = await hashDirectory(outDir);
  const manifest = {
    schema: "akashic.codex-protocol-schema-manifest/v1",
    codex_version: codexVersion ?? await getCodexVersion(command),
    generated_at: new Date().toISOString(),
    protocol_schema_sha256: tree.digest,
    files: tree.files,
    experimental: false,
  };
  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

export function startCodexAppServer(command, {
  cwd,
  env = process.env,
  stderrSink = null,
} = {}) {
  const [file, ...prefix] = normalizeCommand(command);
  // Official App Server defaults to JSONL over stdio. Do not use the experimental
  // WebSocket listener and do not assume a non-standard transport boundary.
  const child = spawn(file, [...prefix, "app-server"], {
    cwd,
    env: { ...env, NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  if (typeof stderrSink === "function") {
    child.stderr.on("data", stderrSink);
  }
  return child;
}

export async function stopProcess(child, { graceMs = 5_000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.stdin?.end();
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), graceMs)),
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGKILL");
}
