import { EventCollector } from "./event-collector.js";
import { extractFinalAgentMessage, parseStructuredTurnOutput } from "./turn-output.js";

export const DEFAULT_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "outcome",
    "context_need",
    "compact_result",
    "artifact_paths",
    "evidence",
  ],
  properties: {
    outcome: { enum: ["INPUT_REQUIRED", "COMPLETED", "FAILED"] },
    context_need: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "request_id",
            "task_id",
            "logical_attempt_id",
            "expected_seq",
            "missing",
            "known_digests",
            "max_tokens",
          ],
          properties: {
            request_id: { type: "string" },
            task_id: { type: "string" },
            logical_attempt_id: { type: "string" },
            expected_seq: { type: "integer" },
            missing: { type: "array", items: { type: "string" } },
            known_digests: { type: "array", items: { type: "string" } },
            max_tokens: { type: "integer" },
          },
        },
        { type: "null" },
      ],
    },
    compact_result: { type: ["string", "null"] },
    artifact_paths: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: { type: "string" } },
  },
});

function textInput(text) {
  return { type: "text", text, text_elements: [] };
}

export class CodexAppServerClient {
  constructor(transport, { turnTimeoutMs = 180_000 } = {}) {
    this.transport = transport;
    this.collector = new EventCollector(transport);
    this.turnTimeoutMs = turnTimeoutMs;
    this.initialized = false;
    this.initializeResponse = null;
    this.selection = null;
    this.threadStartCount = 0;
    this.turnStartCount = 0;
    this.transport.on("protocolError", (error) => this.collector.emit("protocolError", error));
  }

  async initialize() {
    if (this.initialized) return this.initializeResponse;
    this.initializeResponse = await this.transport.request("initialize", {
      clientInfo: {
        name: "akashic-codex-app-server-adapter",
        title: "Akashic Codex App Server Adapter",
        version: "0.10.0",
      },
      capabilities: {
        experimentalApi: false,
        requestAttestation: false,
        optOutNotificationMethods: null,
        extensions: null,
      },
    });
    this.transport.notify("initialized", {});
    this.initialized = true;
    return this.initializeResponse;
  }

  async listModels() {
    if (!this.initialized) throw new Error("initialize must complete before model/list");
    const models = [];
    let cursor = null;
    do {
      const response = await this.transport.request("model/list", {
        cursor,
        limit: 100,
        includeHidden: false,
      });
      if (!Array.isArray(response?.data)) throw new Error("model/list returned invalid data");
      models.push(...response.data);
      cursor = response.nextCursor ?? null;
    } while (cursor);
    return models.filter((model) => model && model.hidden !== true);
  }

  async selectModel({ preferredModel, preferredEffort, preferredServiceTier } = {}) {
    const models = await this.listModels();
    if (models.length === 0) {
      const error = new Error("model/list returned no visible models");
      error.code = "CODEX_NO_AVAILABLE_MODEL";
      throw error;
    }
    const selected = preferredModel
      ? models.find((entry) => entry.model === preferredModel || entry.id === preferredModel)
      : models.find((entry) => entry.isDefault) ?? models[0];
    if (!selected) {
      const error = new Error(`preferred model is unavailable: ${preferredModel}`);
      error.code = "CODEX_MODEL_UNAVAILABLE";
      throw error;
    }
    const efforts = (selected.supportedReasoningEfforts ?? []).map((entry) => entry.reasoningEffort);
    const effort = preferredEffort ?? selected.defaultReasoningEffort ?? efforts[0] ?? null;
    if (effort !== null && !efforts.includes(effort)) {
      const error = new Error(`reasoning effort ${effort} is not supported by ${selected.model}`);
      error.code = "CODEX_REASONING_EFFORT_UNAVAILABLE";
      error.details = { supported: efforts };
      throw error;
    }
    const serviceTierIds = (selected.serviceTiers ?? [])
      .map((entry) => entry.id ?? entry.serviceTier ?? entry.name)
      .filter(Boolean);
    const serviceTier = preferredServiceTier ?? selected.defaultServiceTier ?? serviceTierIds[0] ?? null;
    if (preferredServiceTier && serviceTierIds.length > 0 && !serviceTierIds.includes(preferredServiceTier)) {
      const error = new Error(`service tier ${preferredServiceTier} is not supported by ${selected.model}`);
      error.code = "CODEX_SERVICE_TIER_UNAVAILABLE";
      error.details = { supported: serviceTierIds };
      throw error;
    }
    this.selection = {
      id: selected.id,
      model: selected.model,
      displayName: selected.displayName,
      effort,
      serviceTier,
      supportedReasoningEfforts: efforts,
      serviceTiers: serviceTierIds,
      isDefault: Boolean(selected.isDefault),
    };
    return this.selection;
  }

  async startThread({ cwd, modelSelection = this.selection } = {}) {
    if (!this.initialized) throw new Error("initialize must complete before thread/start");
    if (!modelSelection) throw new Error("model selection must complete before thread/start");
    const response = await this.transport.request("thread/start", {
      cwd,
      model: modelSelection.model,
      serviceTier: modelSelection.serviceTier,
      approvalPolicy: "never",
      sandbox: "workspace-write",
      ephemeral: false,
      serviceName: "akashic-live-two-turn-certification",
    });
    this.threadStartCount += 1;
    if (!response?.thread?.id) throw new Error("thread/start returned no thread id");
    return response;
  }

  async runTurn({
    threadId,
    prompt,
    outputSchema = DEFAULT_OUTPUT_SCHEMA,
    cwd = null,
    timeoutMs = this.turnTimeoutMs,
    modelSelection = this.selection,
  }) {
    const startIndex = this.collector.notifications.length;
    const serverRequestStartIndex = this.collector.serverRequests.length;
    const fatalStartIndex = this.collector.fatalErrors.length;
    const response = await this.transport.request("turn/start", {
      threadId,
      input: [textInput(prompt)],
      cwd,
      approvalPolicy: "never",
      model: modelSelection?.model ?? null,
      serviceTier: modelSelection?.serviceTier ?? null,
      effort: modelSelection?.effort ?? null,
      outputSchema,
    });
    this.turnStartCount += 1;
    const turnId = response?.turn?.id;
    if (!turnId) throw new Error("turn/start returned no turn id");

    let completed;
    try {
      completed = await this.collector.waitForNotification(
        "turn/completed",
        (params) => params.threadId === threadId && params.turn?.id === turnId,
        { timeoutMs, startIndex, serverRequestStartIndex, fatalStartIndex },
      );
    } catch (error) {
      if (error?.code !== "CODEX_NOTIFICATION_TIMEOUT") throw error;
      await this.transport.request("turn/interrupt", { threadId, turnId }, { timeoutMs: 15_000 });
      const interrupted = await this.collector.waitForNotification(
        "turn/completed",
        (params) => params.threadId === threadId && params.turn?.id === turnId,
        { timeoutMs: 15_000, startIndex, serverRequestStartIndex, fatalStartIndex },
      ).catch(() => null);
      const timeoutError = new Error(`turn timed out and was interrupted: ${turnId}`);
      timeoutError.code = "CODEX_TURN_TIMEOUT";
      timeoutError.details = { interrupted };
      throw timeoutError;
    }

    const turn = completed.turn;
    if (turn.status !== "completed") {
      const error = new Error(`turn ended with status ${turn.status}`);
      error.code = "CODEX_TURN_NOT_COMPLETED";
      error.details = { turn };
      throw error;
    }
    const observedItems = this.collector.itemsForTurn(threadId, turnId);
    const message = extractFinalAgentMessage(turn, observedItems);
    const structured = parseStructuredTurnOutput(message);
    return {
      threadId,
      turnId,
      startResponse: response,
      completedNotification: completed,
      structured,
      finalMessage: message,
      observedItems,
    };
  }
}
