import { Client, Connection } from "@temporalio/client";
import { createServer } from "node:http";
import { createRpcRouter } from "./rpc.js";

const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const namespace = process.env.TEMPORAL_NAMESPACE || "default";
const host = process.env.AKASHIC_RUNNER_HOST || "127.0.0.1";
const port = Number(process.env.AKASHIC_RUNNER_PORT || 8766);
const token = process.env.AKASHIC_RUNNER_TOKEN || "";
const connection = await Connection.connect({ address });
const client = new Client({ connection, namespace });
const route = createRpcRouter({ client, taskQueue: process.env.AKASHIC_TASK_QUEUE });

function send(response, status, payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, { "content-type": "application/json", "content-length": bytes.length });
  response.end(bytes);
}
const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/healthz") {
      return send(response, 200, { ok: true, service: "akashic-temporal-runner", workflow_authority: "temporal", namespace });
    }
    if (request.method !== "POST" || request.url !== "/a2a") return send(response, 404, { error: "not_found" });
    if (token && request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: "unauthorized" });
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 1_048_576) throw Object.assign(new Error("request too large"), { code: "payload_too_large" });
      chunks.push(chunk);
    }
    const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await route(envelope.method, envelope.params ?? {});
    return send(response, 200, { jsonrpc: "2.0", id: envelope.id ?? null, result });
  } catch (error) {
    return send(response, 400, { jsonrpc: "2.0", id: null, error: { code: error?.code ?? "runner_error", message: error instanceof Error ? error.message : String(error) } });
  }
});
server.listen(port, host, () => console.log(JSON.stringify({ ok: true, host, port, temporal: address, namespace })));
