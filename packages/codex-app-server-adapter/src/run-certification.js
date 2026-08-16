import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { CodexAppServerClient, DEFAULT_OUTPUT_SCHEMA } from "./client.js";
import { JsonlTransport } from "./jsonl-transport.js";
import { artifactRefForFile } from "./turn-output.js";
import { startCodexAppServer, stopProcess } from "./process-manager.js";
import {
  credentialLeakScanPasses,
  sanitizeString,
  sanitizeValue,
  sha256,
  writeJson,
  writeSha256Sums,
} from "./evidence.js";
import { assertTurnIdentity, buildTurnOnePrompt, buildTurnTwoPrompt } from "./prompts.js";

export async function runSingleCertification({
  command,
  fixtureRoot,
  evidenceRoot,
  protocol,
  iteration = 1,
  preferredModel = process.env.CODEX_MODEL || null,
  preferredEffort = process.env.CODEX_REASONING_EFFORT || null,
  preferredServiceTier = process.env.CODEX_SERVICE_TIER || null,
  turnTimeoutMs = Number(process.env.CODEX_TURN_TIMEOUT_MS || 300_000),
  keepWorkspace = false,
}) {
  const runUuid = randomUUID();
  const runId = `codex-live-${iteration}-${runUuid}`;
  const evidenceDir = path.join(evidenceRoot, runId);
  await mkdir(evidenceDir, { recursive: true });
  const workspace = await mkdtemp(path.join(tmpdir(), "akashic-codex-app-server-"));
  const trace = [];
  const stderrChunks = [];
  const state = {
    schema: "akashic.codex-live-two-turn-evidence/v1",
    status: "RUNNING",
    run_id: runId,
    iteration,
    codex_version: protocol.codexVersion,
    protocol_schema_sha256: protocol.schemaManifest.protocol_schema_sha256,
    started_at: new Date().toISOString(),
    completed_at: null,
    task_id: `codex-app-server-task-${runUuid}`,
    context_id: `codex-app-server-context-${runUuid}`,
    logical_attempt_id: `codex-app-server-attempt-${runUuid}`,
    thread_id: null,
    turn_1_id: null,
    turn_2_id: null,
    thread_start_count: 0,
    turn_start_count: 0,
    turn_1_status: null,
    turn_1_outcome: null,
    turn_2_status: null,
    turn_2_outcome: null,
    context_seq_before: 0,
    context_seq_after: null,
    task_capsule_resent_on_turn_2: false,
    artifact_refs: [],
    event_counts: {},
    model: null,
    reasoning_effort: null,
    service_tier: null,
    initialize: null,
    error: null,
  };
  let child = null;
  let client = null;

  try {
    const taskMarkdown = await readFile(path.join(fixtureRoot, "TASK.md"), "utf8");
    const fixtureReadme = await readFile(path.join(fixtureRoot, "README.md"), "utf8");
    const expectedBytes = await readFile(path.join(fixtureRoot, "expected", "result.txt"));
    const expectedText = expectedBytes.toString("utf8");
    if (!expectedText.endsWith("\n") || expectedText.slice(0, -1).includes("\n")) {
      throw new Error("expected/result.txt must contain exactly one value line");
    }
    const requiredValue = expectedText.slice(0, -1);
    await copyFile(path.join(fixtureRoot, "TASK.md"), path.join(workspace, "TASK.md"));
    await writeFile(path.join(workspace, "README.md"), fixtureReadme, "utf8");

    child = startCodexAppServer(command, {
      cwd: workspace,
      stderrSink: (chunk) => stderrChunks.push(String(chunk)),
    });
    const transport = new JsonlTransport(child, {
      requestTimeoutMs: 60_000,
      trace: (entry) => trace.push(entry),
    });
    client = new CodexAppServerClient(transport, { turnTimeoutMs });

    const initialized = await client.initialize();
    state.initialize = initialized;
    const selection = await client.selectModel({
      preferredModel,
      preferredEffort,
      preferredServiceTier,
    });
    state.model = selection.model;
    state.reasoning_effort = selection.effort;
    state.service_tier = selection.serviceTier;

    const thread = await client.startThread({ cwd: workspace, modelSelection: selection });
    state.thread_id = thread.thread.id;
    const task = {
      task_id: state.task_id,
      context_id: state.context_id,
      logical_attempt_id: state.logical_attempt_id,
      request_id: `context-request-${runUuid}`,
      goal: "Create result.txt only after receiving the missing required value through ContextPacketDelta.",
      acceptance: [
        "turn 1 returns INPUT_REQUIRED without creating result.txt",
        "turn 2 writes expected/result.txt bytes exactly",
        "turn 2 returns COMPLETED on the same Codex thread",
      ],
    };

    const turnOne = await client.runTurn({
      threadId: state.thread_id,
      prompt: buildTurnOnePrompt(task, taskMarkdown),
      outputSchema: DEFAULT_OUTPUT_SCHEMA,
      cwd: workspace,
      modelSelection: selection,
    });
    state.turn_1_id = turnOne.turnId;
    state.turn_1_status = turnOne.completedNotification.turn.status;
    state.turn_1_outcome = turnOne.structured.outcome;
    assertTurnIdentity(turnOne.structured, {
      outcome: "INPUT_REQUIRED",
      task_id: task.task_id,
      logical_attempt_id: task.logical_attempt_id,
      request_id: task.request_id,
      expected_seq: 0,
    });
    if (await stat(path.join(workspace, "result.txt")).then(() => true).catch(() => false)) {
      throw new Error("turn 1 created result.txt before ContextPacketDelta");
    }

    const delta = {
      schema: "akashic.context-packet-delta/v1",
      delta_id: `delta-${runUuid}`,
      task_id: task.task_id,
      logical_attempt_id: task.logical_attempt_id,
      request_id: task.request_id,
      expected_seq: 0,
      content: { required_value: requiredValue },
    };
    const turnTwoPrompt = buildTurnTwoPrompt(delta);
    state.task_capsule_resent_on_turn_2 = [task.goal, ...task.acceptance, taskMarkdown]
      .some((fragment) => fragment && turnTwoPrompt.includes(fragment));
    if (state.task_capsule_resent_on_turn_2) {
      throw new Error("turn 2 prompt resent Task Capsule content");
    }

    const turnTwo = await client.runTurn({
      threadId: state.thread_id,
      prompt: turnTwoPrompt,
      outputSchema: DEFAULT_OUTPUT_SCHEMA,
      cwd: workspace,
      modelSelection: selection,
    });
    state.turn_2_id = turnTwo.turnId;
    state.turn_2_status = turnTwo.completedNotification.turn.status;
    state.turn_2_outcome = turnTwo.structured.outcome;
    assertTurnIdentity(turnTwo.structured, { outcome: "COMPLETED" });
    if (!turnTwo.structured.artifact_paths.includes("result.txt")) {
      throw new Error("turn 2 did not report result.txt");
    }

    const resultPath = path.join(workspace, "result.txt");
    const actualBytes = await readFile(resultPath);
    if (!actualBytes.equals(expectedBytes)) {
      const error = new Error("result.txt bytes do not match expected fixture");
      error.details = {
        expected_sha256: sha256(expectedBytes),
        actual_sha256: sha256(actualBytes),
      };
      throw error;
    }
    const artifactRef = await artifactRefForFile(resultPath, { workspaceRoot: workspace });
    state.artifact_refs = [artifactRef];
    state.thread_start_count = client.threadStartCount;
    state.turn_start_count = client.turnStartCount;
    state.context_seq_after = 1;
    state.event_counts = client.collector.eventCounts();

    const turnStarted = client.collector.notifications.filter(
      (entry) => entry.method === "turn/started" && entry.params?.threadId === state.thread_id,
    );
    const completedIds = new Set(
      client.collector.notifications
        .filter((entry) => entry.method === "turn/completed" && entry.params?.threadId === state.thread_id)
        .map((entry) => entry.params?.turn?.id),
    );
    const checks = {
      official_binary_version_recorded: Boolean(protocol.codexVersion),
      initialized: Boolean(initialized?.userAgent && initialized?.codexHome),
      model_selected_from_catalog: Boolean(selection.model),
      thread_start_once: state.thread_start_count === 1,
      turn_start_twice: state.turn_start_count === 2,
      turn_started_twice:
        turnStarted.some((entry) => entry.params?.turn?.id === state.turn_1_id) &&
        turnStarted.some((entry) => entry.params?.turn?.id === state.turn_2_id),
      turn_completed_twice: completedIds.has(state.turn_1_id) && completedIds.has(state.turn_2_id),
      same_thread: turnOne.threadId === turnTwo.threadId && turnTwo.threadId === state.thread_id,
      turn_1_input_required: state.turn_1_outcome === "INPUT_REQUIRED",
      turn_2_completed: state.turn_2_outcome === "COMPLETED",
      delta_only_turn_2: state.task_capsule_resent_on_turn_2 === false,
      result_exact: actualBytes.equals(expectedBytes),
      artifact_digest_exact: artifactRef.digest === sha256(actualBytes) && artifactRef.size === actualBytes.length,
      no_interactive_requests: client.collector.serverRequests.length === 0,
    };
    if (!Object.values(checks).every(Boolean)) {
      const error = new Error("certification checks failed");
      error.details = checks;
      throw error;
    }

    await writeJson(path.join(evidenceDir, "turn-1-result.json"), turnOne.structured);
    await writeJson(path.join(evidenceDir, "context-delta.json"), delta);
    await writeJson(path.join(evidenceDir, "turn-2-result.json"), turnTwo.structured);
    await writeJson(path.join(evidenceDir, "artifact-manifest.json"), {
      schema: "akashic.codex-artifact-manifest/v1",
      expected_sha256: sha256(expectedBytes),
      expected_size: expectedBytes.length,
      actual: artifactRef,
    });
    await writeJson(path.join(evidenceDir, "checks.json"), checks);
    state.status = "PASS";
    state.completed_at = new Date().toISOString();
  } catch (error) {
    state.status = "FAILED";
    state.completed_at = new Date().toISOString();
    state.error = {
      code: error?.code ?? "CODEX_CERTIFICATION_FAILED",
      message: error instanceof Error ? error.message : String(error),
      details: error?.details ?? null,
    };
  } finally {
    if (client) {
      state.thread_start_count = client.threadStartCount;
      state.turn_start_count = client.turnStartCount;
      state.event_counts = client.collector.eventCounts();
    }
    await stopProcess(child).catch(() => {});
    const replacements = [
      [workspace, "<WORKSPACE>"],
      [homedir(), "<HOME>"],
      [state.initialize?.codexHome, "<CODEX_HOME>"],
    ].filter(([needle]) => Boolean(needle));
    const sanitizedTrace = trace.map((entry) => sanitizeValue(entry, replacements));
    const sanitizedStderr = sanitizeString(stderrChunks.join(""), replacements);
    await writeFile(
      path.join(evidenceDir, "sanitized-protocol.jsonl"),
      sanitizedTrace.map((entry) => JSON.stringify(entry)).join("\n") +
        (sanitizedTrace.length ? "\n" : ""),
      "utf8",
    );
    await writeJson(
      path.join(evidenceDir, "requests.json"),
      sanitizedTrace.filter((entry) => entry.direction === "out"),
    );
    await writeJson(
      path.join(evidenceDir, "events.json"),
      sanitizedTrace.filter((entry) => entry.direction === "in" && entry.message?.method),
    );
    await writeFile(path.join(evidenceDir, "stderr.log"), sanitizedStderr, "utf8");
    state.credential_leak_scan_passed = credentialLeakScanPasses(
      JSON.stringify(sanitizedTrace) + sanitizedStderr,
    );
    if (!state.credential_leak_scan_passed && state.status === "PASS") {
      state.status = "FAILED";
      state.error = {
        code: "CREDENTIAL_LEAK_SCAN_FAILED",
        message: "sanitized evidence still contains credential-like material",
        details: null,
      };
    }
    await writeJson(
      path.join(evidenceDir, "manifest.json"),
      sanitizeValue(state, replacements),
    );
    await writeSha256Sums(evidenceDir);
    if (!keepWorkspace) await rm(workspace, { recursive: true, force: true });
  }

  if (state.status !== "PASS") {
    const error = new Error(state.error?.message ?? "Codex certification failed");
    error.code = state.error?.code ?? "CODEX_CERTIFICATION_FAILED";
    error.details = { evidenceDir, manifest: state };
    throw error;
  }
  return { evidenceDir, manifest: state };
}
