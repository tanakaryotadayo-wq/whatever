export const ROUTING_POLICY_VERSION = "akashic.routing-policy/v1";
export const EXECUTION_LANES = Object.freeze(["fast", "durable"]);
function asBoolean(value) { return value === true; }
export function decideExecutionLane(input, policy = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("routing input must be an object");
  if (typeof input.task_id !== "string" || input.task_id.length === 0) throw new TypeError("routing input requires task_id");
  const thresholdMinutes = policy.threshold_minutes ?? 5;
  if (typeof thresholdMinutes !== "number" || thresholdMinutes <= 0) throw new TypeError("threshold_minutes must be positive");
  if (input.operator_override !== undefined && !EXECUTION_LANES.includes(input.operator_override)) throw new TypeError("operator_override must be fast or durable");
  const durableReasons = [];
  const expectedMinutes = Number(input.expected_minutes ?? 0);
  if (Number.isFinite(expectedMinutes) && expectedMinutes > thresholdMinutes) durableReasons.push("EXPECTED_DURATION");
  if (asBoolean(input.needs_wait)) durableReasons.push("EXTERNAL_INPUT_WAIT");
  if (asBoolean(input.remote_worker)) durableReasons.push("REMOTE_WORKER");
  if (asBoolean(input.artifact_adoption)) durableReasons.push("ARTIFACT_ADOPTION");
  if (asBoolean(input.multi_agent)) durableReasons.push("MULTI_AGENT");
  if (asBoolean(input.restart_required)) durableReasons.push("RESTART_RECOVERY");
  if (asBoolean(input.policy_gate)) durableReasons.push("POLICY_GATE");
  const automaticLane = durableReasons.length > 0 ? "durable" : "fast";
  const lane = input.operator_override ?? automaticLane;
  const reasons = input.operator_override ? [`OPERATOR_OVERRIDE_${input.operator_override.toUpperCase()}`, ...durableReasons] : (durableReasons.length > 0 ? durableReasons : ["SHORT_INTERACTIVE_TASK"]);
  return { schema: "akashic.routing-decision/v1", task_id: input.task_id, lane, automatic_lane: automaticLane, reasons, policy_version: policy.version ?? ROUTING_POLICY_VERSION, threshold_minutes: thresholdMinutes };
}
export function validateRoutingDecision(decision) {
  if (decision?.schema !== "akashic.routing-decision/v1") throw new TypeError("invalid routing decision schema");
  if (!EXECUTION_LANES.includes(decision.lane)) throw new TypeError("invalid execution lane");
  if (!Array.isArray(decision.reasons) || decision.reasons.length === 0) throw new TypeError("routing decision requires reasons");
  return structuredClone(decision);
}
