export const DEFAULT_DEPLOYMENT_NAME = "akashic-agent-operating-layer";

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`INVALID_BOOLEAN:${value}`);
}

function requireBounded(value, field) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 255) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value.trim();
}

export function resolveWorkerDeploymentOptions(env = process.env) {
  const explicit = parseBoolean(env.AKASHIC_TEMPORAL_VERSIONING);
  const controllerManaged = Boolean(env.TEMPORAL_DEPLOYMENT_NAME && env.TEMPORAL_WORKER_BUILD_ID);
  const enabled = explicit ?? controllerManaged;
  if (!enabled) return undefined;

  const deploymentName = requireBounded(
    env.AKASHIC_TEMPORAL_DEPLOYMENT_NAME || env.TEMPORAL_DEPLOYMENT_NAME || DEFAULT_DEPLOYMENT_NAME,
    "deployment_name"
  );
  const buildId = requireBounded(
    env.AKASHIC_TEMPORAL_BUILD_ID ||
      env.TEMPORAL_WORKER_BUILD_ID ||
      env.GITHUB_SHA ||
      env.VERCEL_GIT_COMMIT_SHA ||
      "",
    "build_id"
  );

  return Object.freeze({
    useWorkerVersioning: true,
    version: Object.freeze({ deploymentName, buildId }),
    defaultVersioningBehavior: "PINNED"
  });
}
