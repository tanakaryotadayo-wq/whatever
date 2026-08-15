import { NativeConnection } from "@temporalio/worker";
import { createWorkerTopology, runWorkerTopology } from "./worker-topology.js";

const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const namespace = process.env.TEMPORAL_NAMESPACE || "default";
const tls = String(process.env.TEMPORAL_TLS || "false").toLowerCase() === "true" ? {} : undefined;
const connection = await NativeConnection.connect({
  address,
  tls,
  apiKey: process.env.TEMPORAL_API_KEY || undefined
});

try {
  const workers = await createWorkerTopology({ connection, namespace, env: process.env });
  await runWorkerTopology(workers);
} finally {
  await connection.close();
}
