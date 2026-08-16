import { access, readFile } from "node:fs/promises";

const root = "gpts/codex-mode";
const required = [
  `${root}/README.md`,
  `${root}/GPT_INSTRUCTIONS.md`,
  `${root}/GPT_BUILDER_CONFIG.md`,
  `${root}/KNOWLEDGE_INDEX.md`,
  `${root}/PRIVACY_POLICY.md`,
  `${root}/EVALS.jsonl`,
  `${root}/openapi.json`,
  `${root}/GPT_PACKAGE.json`,
  `${root}/PREVIEW_ACCEPTANCE.md`,
  "deploy/vercel-chatgpt-app/lib/codex-mode-gpt-actions.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/boot/route.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/status/route.js",
  "deploy/vercel-chatgpt-app/app/api/codex-mode/evidence/route.js",
  "deploy/vercel-chatgpt-app/tests/codex-mode-gpt-actions.test.mjs",
  "deploy/vercel-chatgpt-app/public/codex-mode-openapi.json",
  "deploy/vercel-chatgpt-app/app/privacy/codex-mode/route.js",
  "docs/ADR-0014-CODEX-MODE-GPT-ACTIONS.md",
  "knowledge/adoption-receipts/codex-mode-gpt-actions-v1.json",
];

for (const path of required) await access(path);

const instructions = await readFile(`${root}/GPT_INSTRUCTIONS.md`, "utf8");
for (const token of [
  "bootCodexMode",
  "getCodexModeStatus",
  "getCodexModeEvidence",
  "startAkashicWorkflow",
  "applyAkashicContextDelta",
  "cancelAkashicWorkflow",
  "CERTIFIED",
]) {
  if (!instructions.includes(token)) {
    throw new Error(`GPT instructions missing required token: ${token}`);
  }
}

const openapi = JSON.parse(
  await readFile(`${root}/openapi.json`, "utf8"),
);
if (openapi.openapi !== "3.1.0") throw new Error("OpenAPI must be 3.1.0");
const server = openapi.servers?.[0]?.url;
if (server !== "https://akashic-vercel-canonical-p0.vercel.app") {
  throw new Error(`unexpected production Action server: ${server}`);
}

const publicOpenapi = JSON.parse(
  await readFile("deploy/vercel-chatgpt-app/public/codex-mode-openapi.json", "utf8"),
);
if (JSON.stringify(publicOpenapi) !== JSON.stringify(openapi)) {
  throw new Error("deployed public OpenAPI copy differs from Builder schema");
}

const builderPackage = JSON.parse(
  await readFile(`${root}/GPT_PACKAGE.json`, "utf8"),
);
if (builderPackage.actions?.schema_url !== `${server}/codex-mode-openapi.json`) {
  throw new Error("GPT package schema URL does not match OpenAPI server");
}
if (
  builderPackage.capabilities?.apps !== false ||
  builderPackage.capabilities?.actions !== true
) {
  throw new Error("GPT package must choose Actions and disable Apps");
}

const operations = [];
for (const [path, item] of Object.entries(openapi.paths ?? {})) {
  for (const [method, operation] of Object.entries(item)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    if (!operation.operationId) {
      throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
    }
    operations.push(operation.operationId);
  }
}
const expected = [
  "getGatewayHealth",
  "bootCodexMode",
  "getCodexModeStatus",
  "getCodexModeEvidence",
  "startAkashicWorkflow",
  "getAkashicWorkflow",
  "applyAkashicContextDelta",
  "cancelAkashicWorkflow",
];
for (const operationId of expected) {
  if (!operations.includes(operationId)) {
    throw new Error(`OpenAPI missing operationId: ${operationId}`);
  }
}
if (new Set(operations).size !== operations.length) {
  throw new Error("OpenAPI operationIds must be unique");
}

const lines = (await readFile(`${root}/EVALS.jsonl`, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean);
if (lines.length < 8) throw new Error("GPT Preview eval corpus is too small");
for (const [index, line] of lines.entries()) {
  const value = JSON.parse(line);
  if (!value.id || !value.prompt) {
    throw new Error(`invalid eval line ${index + 1}`);
  }
}

const combined = [
  instructions,
  await readFile(`${root}/GPT_BUILDER_CONFIG.md`, "utf8"),
  await readFile(`${root}/openapi.json`, "utf8"),
  await readFile(`${root}/GPT_PACKAGE.json`, "utf8"),
  await readFile(`${root}/PREVIEW_ACCEPTANCE.md`, "utf8"),
].join("\n");
if (/sk-[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9_-]{16,}/.test(combined)) {
  throw new Error("GPT package appears to contain credential material");
}
if (!combined.includes("Apps: OFF")) {
  throw new Error("GPT package must explicitly disable Apps when using Actions");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "codex-mode-gpt-actions-v1",
    files: required.length,
    operations,
    evals: lines.length,
  }),
);
