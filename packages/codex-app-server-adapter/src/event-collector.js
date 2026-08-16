import { EventEmitter } from "node:events";

export class CodexServerRequestError extends Error {
  constructor(request) {
    super(`interactive server request rejected: ${request.method}`);
    this.name = "CodexServerRequestError";
    this.code = "CODEX_INTERACTIVE_REQUEST_REJECTED";
    this.request = request;
  }
}

export class EventCollector extends EventEmitter {
  constructor(transport) {
    super();
    this.transport = transport;
    this.notifications = [];
    this.serverRequests = [];
    this.fatalErrors = [];
    transport.on("notification", (message) => {
      this.notifications.push(message);
      this.emit("notification", message);
    });
    for (const eventName of ["protocolError", "closed", "exit"]) {
      transport.on(eventName, (details) => {
        const error = details instanceof Error
          ? details
          : Object.assign(new Error(`Codex transport fatal event: ${eventName}`), {
              code: "CODEX_TRANSPORT_FATAL",
              details,
            });
        this.fatalErrors.push(error);
        this.emit("fatal", error);
      });
    }
    transport.on("serverRequest", (message) => {
      this.serverRequests.push(message);
      try {
        transport.respondError(
          message.id,
          "Akashic live certification does not approve interactive requests",
          {
            code: -32001,
            data: { code: "AKASHIC_FAIL_CLOSED_INTERACTIVE_REQUEST" },
          },
        );
      } finally {
        this.emit("serverRequest", message);
      }
    });
  }

  notificationCount(method) {
    return this.notifications.filter((entry) => entry.method === method).length;
  }

  eventCounts() {
    const counts = {};
    for (const message of this.notifications) {
      counts[message.method] = (counts[message.method] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  }

  itemsForTurn(threadId, turnId) {
    return this.notifications
      .filter((entry) => {
        if (!["item/started", "item/completed", "item/agentMessage/delta"].includes(entry.method)) {
          return false;
        }
        return (
          entry.params?.threadId === threadId &&
          entry.params?.turnId === turnId
        );
      })
      .map((entry) => entry.params?.item)
      .filter(Boolean);
  }

  waitForNotification(method, predicate, {
    timeoutMs = 120_000,
    startIndex = 0,
    serverRequestStartIndex = 0,
    fatalStartIndex = 0,
  } = {}) {
    const existing = this.notifications
      .slice(startIndex)
      .find((entry) => entry.method === method && predicate(entry.params ?? {}));
    if (existing) return Promise.resolve(existing.params ?? {});
    const existingRequest = this.serverRequests[serverRequestStartIndex];
    if (existingRequest) return Promise.reject(new CodexServerRequestError(existingRequest));
    const existingFatal = this.fatalErrors[fatalStartIndex];
    if (existingFatal) return Promise.reject(existingFatal);

    return new Promise((resolve, reject) => {
      let timer;
      const onNotification = (entry) => {
        if (entry.method !== method || !predicate(entry.params ?? {})) return;
        cleanup();
        resolve(entry.params ?? {});
      };
      const onServerRequest = (entry) => {
        cleanup();
        reject(new CodexServerRequestError(entry));
      };
      const onFatal = (error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.off("notification", onNotification);
        this.off("serverRequest", onServerRequest);
        this.off("fatal", onFatal);
      };
      timer = setTimeout(() => {
        cleanup();
        const error = new Error(`notification timed out: ${method}`);
        error.code = "CODEX_NOTIFICATION_TIMEOUT";
        reject(error);
      }, timeoutMs);
      this.on("notification", onNotification);
      this.on("serverRequest", onServerRequest);
      this.on("fatal", onFatal);
    });
  }
}
