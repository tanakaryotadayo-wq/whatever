import { fileURLToPath } from "node:url";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities.js";
import { TASK_QUEUES, assertTaskQueueTopology } from "./task-queues.js";
import { resolveWorkerDeploymentOptions } from "./worker-deployment.js";

export const WORKER_ROLES = Object.freeze(["workflow", "context", "agent", "assurance"]);

export function buildWorkerOptionSpecs({ connection, namespace = "default", env = process.env } = {}) {
  if (!connection) throw new Error("TEMPORAL_CONNECTION_REQUIRED");
  assertTaskQueueTopology(TASK_QUEUES);
  const deployment = resolveWorkerDeploymentOptions(env);
  const versionLabel = deployment?.version?.buildId || "unversioned";
  const common = {
    connection,
    namespace,
    shutdownGraceTime: "30 seconds",
    ...(deployment ? { workerDeploymentOptions: deployment } : {})
  };

  return [
    {
      role: "workflow",
      options: {
        ...common,
        identity: `akashic:workflow:${versionLabel}:${process.pid}`,
        taskQueue: TASK_QUEUES.workflow,
        workflowsPath: fileURLToPath(new URL("./workflows.js", import.meta.url)),
        enableNonLocalActivities: false
      }
    },
    {
      role: "context",
      options: {
        ...common,
        identity: `akashic:context:${versionLabel}:${process.pid}`,
        taskQueue: TASK_QUEUES.context,
        activities: {
          compileContext: activities.compileContext,
          mergeContextDelta: activities.mergeContextDelta
        }
      }
    },
    {
      role: "agent",
      options: {
        ...common,
        identity: `akashic:agent:${versionLabel}:${process.pid}`,
        taskQueue: TASK_QUEUES.agent,
        activities: { runAgentTurn: activities.runAgentTurn }
      }
    },
    {
      role: "assurance",
      options: {
        ...common,
        identity: `akashic:assurance:${versionLabel}:${process.pid}`,
        taskQueue: TASK_QUEUES.assurance,
        activities: {
          verifyCandidate: activities.verifyCandidate,
          adoptArtifact: activities.adoptArtifact
        }
      }
    }
  ];
}

export async function createWorkerTopology(input) {
  const specs = buildWorkerOptionSpecs(input);
  return Promise.all(
    specs.map(async ({ role, options }) => ({ role, taskQueue: options.taskQueue, worker: await Worker.create(options) }))
  );
}

export async function runWorkerTopology(entries) {
  const runs = entries.map(({ worker }) => worker.run());
  try {
    await Promise.all(runs);
  } finally {
    for (const { worker } of entries) worker.shutdown();
    await Promise.allSettled(runs);
  }
}
