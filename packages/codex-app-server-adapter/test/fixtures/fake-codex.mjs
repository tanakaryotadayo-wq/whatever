#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("codex-cli 0.0.0-fake");
  process.exit(0);
}
if (args[0] === "app-server" && args[1] === "--help") {
  console.log("fake codex app-server --stdio (default)");
  process.exit(0);
}
if (args[0] === "app-server" && ["generate-json-schema", "generate-ts"].includes(args[1])) {
  const outIndex = args.indexOf("--out");
  if (outIndex < 0 || !args[outIndex + 1]) process.exit(2);
  const out = args[outIndex + 1];
  await mkdir(out, { recursive: true });
  if (args[1] === "generate-json-schema") {
    await writeFile(path.join(out, "ClientRequest.json"), JSON.stringify({ title: "FakeClientRequest", type: "object" }));
  } else {
    await writeFile(path.join(out, "ClientRequest.ts"), "export type ClientRequest = unknown;\n");
  }
  process.exit(0);
}
if (args[0] !== "app-server") {
  console.error(`unsupported fake codex args: ${args.join(" ")}`);
  process.exit(2);
}

const threads = new Map();
let threadCounter = 0;
let turnCounter = 0;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function turn(id, status, items = []) {
  return {
    id,
    items,
    itemsView: "full",
    status,
    error: null,
    startedAt: Date.now() / 1000,
    completedAt: status === "completed" ? Date.now() / 1000 : null,
    durationMs: status === "completed" ? 1 : null,
  };
}

function extract(text, key) {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
  return match?.[1] ?? null;
}

const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of reader) {
  if (!line.trim()) continue;
  const message = JSON.parse(line);
  if (Object.prototype.hasOwnProperty.call(message, "id") && !message.method) continue;
  if (message.method === "initialized") continue;
  if (message.method === "initialize") {
    send({ id: message.id, result: {
      userAgent: "fake-codex-app-server/0.0.0",
      codexHome: "/fake/codex/home",
      platformFamily: "unix",
      platformOs: "linux",
    } });
    continue;
  }
  if (message.method === "model/list") {
    send({ id: message.id, result: {
      data: [{
        id: "fake-model",
        model: "fake-model",
        upgrade: null,
        upgradeInfo: null,
        availabilityNux: null,
        displayName: "Fake Model",
        description: "Fixture model",
        modelSpecialty: null,
        hidden: false,
        supportedReasoningEfforts: [
          { reasoningEffort: "medium", description: "fixture" },
          { reasoningEffort: "high", description: "fixture" },
        ],
        defaultReasoningEffort: "medium",
        inputModalities: ["text"],
        supportsPersonality: false,
        multiAgentVersion: null,
        additionalSpeedTiers: [],
        serviceTiers: [{ id: "default", displayName: "Default" }],
        defaultServiceTier: "default",
        isDefault: true,
      }],
      nextCursor: null,
    } });
    continue;
  }
  if (message.method === "thread/start") {
    const id = `thread-${++threadCounter}`;
    threads.set(id, { cwd: message.params.cwd, turns: 0 });
    send({ id: message.id, result: {
      thread: { id, turns: [], ephemeral: false, path: `/fake/${id}.jsonl` },
      model: message.params.model,
      modelProvider: "fake",
      serviceTier: "default",
      cwd: message.params.cwd,
      instructionSources: [],
      approvalPolicy: "never",
      approvalsReviewer: "user",
      sandbox: { type: "workspaceWrite" },
      reasoningEffort: "medium",
    } });
    send({ method: "thread/started", params: { thread: { id, turns: [] } } });
    continue;
  }
  if (message.method === "turn/start") {
    const thread = threads.get(message.params.threadId);
    if (!thread) {
      send({ id: message.id, error: { code: -32602, message: "unknown thread" } });
      continue;
    }
    thread.turns += 1;
    const turnId = `turn-${++turnCounter}`;
    const running = turn(turnId, "inProgress", []);
    send({ id: message.id, result: { turn: running } });
    send({ method: "turn/started", params: { threadId: message.params.threadId, turn: running } });
    if (process.env.FAKE_CODEX_SERVER_REQUEST === "1") {
      send({
        id: `server-request-${turnId}`,
        method: "item/commandExecution/requestApproval",
        params: { threadId: message.params.threadId, turnId, itemId: `item-${turnId}` },
      });
      continue;
    }
    const prompt = message.params.input?.[0]?.text ?? "";
    let output;
    if (thread.turns === 1) {
      output = {
        outcome: "INPUT_REQUIRED",
        context_need: {
          request_id: extract(prompt, "required_request_id"),
          task_id: extract(prompt, "task_id"),
          logical_attempt_id: extract(prompt, "logical_attempt_id"),
          expected_seq: 0,
          missing: ["required_value"],
          known_digests: [],
          max_tokens: 1024,
        },
        compact_result: "required_value is missing",
        artifact_paths: [],
        evidence: ["fixture-turn-1"],
      };
    } else {
      const requiredValue = extract(prompt, "required_value");
      await writeFile(path.join(thread.cwd, "result.txt"), `${requiredValue}\n`, "utf8");
      output = {
        outcome: "COMPLETED",
        context_need: null,
        compact_result: "result.txt created from ContextPacketDelta",
        artifact_paths: ["result.txt"],
        evidence: ["fixture-turn-2"],
      };
    }
    const item = {
      type: "agentMessage",
      id: `item-${turnId}`,
      text: JSON.stringify(output),
      phase: "final_answer",
      memoryCitation: null,
    };
    send({ method: "item/started", params: { threadId: message.params.threadId, turnId, item } });
    send({ method: "item/completed", params: { threadId: message.params.threadId, turnId, item } });
    const completed = turn(turnId, "completed", [item]);
    send({ method: "turn/completed", params: { threadId: message.params.threadId, turn: completed } });
    continue;
  }
  if (message.method === "turn/interrupt") {
    send({ id: message.id, result: {} });
    continue;
  }
  send({ id: message.id, error: { code: -32601, message: `unknown method ${message.method}` } });
}
