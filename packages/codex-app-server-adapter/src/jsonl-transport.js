import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

export class ProtocolError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProtocolError";
    this.code = "CODEX_PROTOCOL_ERROR";
    this.details = details;
  }
}

export class JsonlTransport extends EventEmitter {
  constructor(child, { requestTimeoutMs = 30_000, trace = null } = {}) {
    super();
    if (!child?.stdin || !child?.stdout) {
      throw new TypeError("child process must expose stdin and stdout");
    }
    this.child = child;
    this.requestTimeoutMs = requestTimeoutMs;
    this.trace = typeof trace === "function" ? trace : null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    this.reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
    this.reader.on("line", (line) => this.#onLine(line));
    this.reader.on("close", () => this.#onClose("stdout_closed"));
    child.once("exit", (code, signal) => {
      this.emit("exit", { code, signal });
      this.#onClose("process_exit", { code, signal });
    });
    child.once("error", (error) => this.#onClose("process_error", { error }));
  }

  #record(direction, message) {
    this.trace?.({ at: new Date().toISOString(), direction, message });
  }

  #write(message) {
    if (this.closed) throw new ProtocolError("transport is closed");
    const line = `${JSON.stringify(message)}\n`;
    this.#record("out", message);
    if (!this.child.stdin.write(line, "utf8")) {
      this.child.stdin.once("drain", () => this.emit("drain"));
    }
  }

  #onLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      const protocolError = new ProtocolError("app-server emitted non-JSON stdout", {
        line,
        cause: error instanceof Error ? error.message : String(error),
      });
      this.emit("protocolError", protocolError);
      this.#onClose("invalid_json", { error: protocolError });
      return;
    }
    this.#record("in", message);

    const hasId = Object.prototype.hasOwnProperty.call(message, "id");
    const hasMethod = typeof message.method === "string";
    if (hasId && !hasMethod) {
      const pending = this.pending.get(String(message.id));
      if (!pending) {
        this.emit("orphanResponse", message);
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(String(message.id));
      if (message.error) {
        const error = new ProtocolError(
          message.error.message ?? `request ${pending.method} failed`,
          { method: pending.method, rpcError: message.error },
        );
        error.code = message.error?.data?.code ?? "CODEX_RPC_ERROR";
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (hasMethod && hasId) {
      this.emit("serverRequest", message);
      return;
    }
    if (hasMethod) {
      this.emit("notification", message);
      this.emit(`notification:${message.method}`, message.params ?? {});
      return;
    }
    this.emit("unknownMessage", message);
  }

  #onClose(reason, details = {}) {
    if (this.closed) return;
    this.closed = true;
    const error = new ProtocolError(`transport closed: ${reason}`, details);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit("closed", { reason, ...details });
  }

  request(method, params = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id));
        const error = new ProtocolError(`request timed out: ${method}`, {
          method,
          timeoutMs,
        });
        error.code = "CODEX_REQUEST_TIMEOUT";
        reject(error);
      }, timeoutMs);
      this.pending.set(String(id), { method, resolve, reject, timer });
      try {
        this.#write({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(String(id));
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  respondError(id, message, { code = -32001, data = null } = {}) {
    this.#write({ id, error: { code, message, data } });
  }

  close() {
    if (this.closed) return;
    this.child.stdin.end();
  }
}
