import { NativeConnection, Worker } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import * as activities from "./activities.js";
import { taskQueue } from "./shared.js";

const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const namespace = process.env.TEMPORAL_NAMESPACE || "default";
const connection = await NativeConnection.connect({ address });
const worker = await Worker.create({
  connection,
  namespace,
  taskQueue: process.env.AKASHIC_TASK_QUEUE || taskQueue,
  workflowsPath: fileURLToPath(new URL("./workflows.js", import.meta.url)),
  activities
});
await worker.run();
