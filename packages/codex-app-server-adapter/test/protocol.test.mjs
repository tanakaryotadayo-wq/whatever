import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CodexAppServerClient,
  JsonlTransport,
  startCodexAppServer,
  stopProcess,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fake = path.join(here, "fixtures", "fake-codex.mjs");

test("JSONL protocol performs initialize before model/list and starts one thread", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "akashic-protocol-test-"));
  const child = startCodexAppServer([process.execPath, fake], { cwd });
  const trace = [];
  const transport = new JsonlTransport(child, { trace: (entry) => trace.push(entry) });
  const client = new CodexAppServerClient(transport);
  try {
    const initialized = await client.initialize();
    assert.equal(initialized.platformOs, "linux");
    const selection = await client.selectModel();
    assert.equal(selection.model, "fake-model");
    assert.equal(selection.effort, "medium");
    const thread = await client.startThread({ cwd, modelSelection: selection });
    assert.match(thread.thread.id, /^thread-/);
    const outboundMethods = trace
      .filter((entry) => entry.direction === "out")
      .map((entry) => entry.message.method);
    assert.deepEqual(outboundMethods.slice(0, 4), [
      "initialize",
      "initialized",
      "model/list",
      "thread/start",
    ]);
  } finally {
    await stopProcess(child);
    await rm(cwd, { recursive: true, force: true });
  }
});

test("interactive App Server requests fail closed even when emitted before the waiter is installed", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "akashic-protocol-request-test-"));
  const child = startCodexAppServer([process.execPath, fake], {
    cwd,
    env: { ...process.env, FAKE_CODEX_SERVER_REQUEST: "1" },
  });
  const transport = new JsonlTransport(child);
  const client = new CodexAppServerClient(transport, { turnTimeoutMs: 5_000 });
  try {
    await client.initialize();
    const selection = await client.selectModel();
    const thread = await client.startThread({ cwd, modelSelection: selection });
    await assert.rejects(
      client.runTurn({
        threadId: thread.thread.id,
        prompt: "trigger approval request",
        cwd,
        modelSelection: selection,
      }),
      (error) => error.code === "CODEX_INTERACTIVE_REQUEST_REJECTED",
    );
    assert.equal(client.collector.serverRequests.length, 1);
  } finally {
    await stopProcess(child);
    await rm(cwd, { recursive: true, force: true });
  }
});
