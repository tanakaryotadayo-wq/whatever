import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|api[-_]?key|refresh/i;
const SECRET_VALUE = /(Bearer\s+[A-Za-z0-9._~+\/-]+=*|sk-[A-Za-z0-9_-]{12,})/g;

export function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function safeVersion(value) {
  return String(value)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function sanitizeString(value, replacements) {
  let output = String(value).replaceAll("\u0000", "");
  for (const [needle, replacement] of replacements) {
    if (needle) output = output.split(needle).join(replacement);
  }
  return output.replace(SECRET_VALUE, "[REDACTED_SECRET]");
}

export function sanitizeValue(value, replacements, key = "") {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return sanitizeString(value, replacements);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        sanitizeValue(child, replacements, childKey),
      ]),
    );
  }
  return value;
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function walkFiles(root, current = root) {
  const names = await readdir(current).catch(() => []);
  const files = [];
  for (const name of names.sort()) {
    const full = path.join(current, name);
    const info = await stat(full);
    if (info.isDirectory()) files.push(...await walkFiles(root, full));
    else if (info.isFile()) files.push(full);
  }
  return files;
}

export async function writeSha256Sums(root) {
  const target = path.join(root, "sha256sums.json");
  const files = (await walkFiles(root)).filter((file) => file !== target);
  const sums = [];
  for (const file of files) {
    const bytes = await readFile(file);
    sums.push({
      path: path.relative(root, file).split(path.sep).join("/"),
      sha256: sha256(bytes),
      size: bytes.length,
    });
  }
  await writeJson(target, {
    schema: "akashic.evidence-sha256sums/v1",
    generated_at: new Date().toISOString(),
    files: sums,
  });
  return sums;
}

export function credentialLeakScanPasses(text) {
  return !/(Bearer\s+[A-Za-z0-9._~+\/-]{8,}|sk-[A-Za-z0-9_-]{12,})/.test(text);
}
