import test from "node:test";
import assert from "node:assert/strict";
import { TASK_QUEUES, assertTaskQueueTopology } from "../src/task-queues.js";
import { resolveWorkerDeploymentOptions } from "../src/worker-deployment.js";
import { buildWorkerOptionSpecs } from "../src/worker-topology.js";

const fakeConnection = {};

test("workflow, context, agent and assurance queues are distinct", () => {
  const queues = assertTaskQueueTopology();
  assert.equal(new Set(Object.values(queues)).size, 4);
  assert.equal(queues.workflow, TASK_QUEUES.workflow);
});

test("versioning is opt-in outside Temporal Worker Controller", () => {
  assert.equal(resolveWorkerDeploymentOptions({}), undefined);
});

test("versioned workers use official Deployment Versioning shape and pin workflows", () => {
  const options = resolveWorkerDeploymentOptions({
    AKASHIC_TEMPORAL_VERSIONING: "1",
    AKASHIC_TEMPORAL_DEPLOYMENT_NAME: "akashic",
    AKASHIC_TEMPORAL_BUILD_ID: "git-abc123"
  });
  assert.deepEqual(options, {
    useWorkerVersioning: true,
    version: { deploymentName: "akashic", buildId: "git-abc123" },
    defaultVersioningBehavior: "PINNED"
  });
});

test("Temporal Worker Controller environment enables the same deployment across all queues", () => {
  const env = { TEMPORAL_DEPLOYMENT_NAME: "akashic", TEMPORAL_WORKER_BUILD_ID: "build-2" };
  const specs = buildWorkerOptionSpecs({ connection: fakeConnection, namespace: "test", env });
  assert.deepEqual(specs.map((entry) => entry.role), ["workflow", "context", "agent", "assurance"]);
  assert.equal(new Set(specs.map((entry) => entry.options.taskQueue)).size, 4);
  assert.ok(specs.every((entry) => entry.options.workerDeploymentOptions.version.buildId === "build-2"));
  assert.ok(specs.every((entry) => entry.options.workerDeploymentOptions.defaultVersioningBehavior === "PINNED"));
});

test("versioning fails closed without a stable build id", () => {
  assert.throws(() => resolveWorkerDeploymentOptions({ AKASHIC_TEMPORAL_VERSIONING: "1" }), /INVALID_BUILD_ID/);
});
