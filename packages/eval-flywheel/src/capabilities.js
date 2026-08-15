import {
  claimEffect,
  completeEffect,
  decideExecutionLane,
  decideSessionRecovery,
  evaluatePolicy,
  makeContextCacheKey,
  projectMcpTask,
  validateContextDelta,
  validateTransition
} from "@akashic/contracts";

function contextCacheProbe({ first, second, changed }) {
  const firstKey = makeContextCacheKey(first);
  const secondKey = makeContextCacheKey(second ?? first);
  const changedKey = makeContextCacheKey(changed ?? first);
  return { same_inputs_same_key: firstKey === secondKey, changed_inputs_change_key: firstKey !== changedKey };
}

function staleFenceProbe({ effect_key, subject_digest, result_digest }) {
  const first = claimEffect(null, { effect_key, subject_digest, owner: "worker-1" });
  const takeover = claimEffect(first, { effect_key, subject_digest, owner: "worker-2", takeover: true });
  return completeEffect(takeover, { owner: first.owner, generation: first.generation, result_digest });
}

export const DEFAULT_CAPABILITIES = Object.freeze({
  "routing.decide": ({ input, policy }) => decideExecutionLane(input, policy),
  "policy.evaluate": ({ rules, request, options }) => evaluatePolicy(rules, request, options),
  "session.recovery": ({ capability, state }) => decideSessionRecovery(capability, state),
  "context.cache-key-probe": contextCacheProbe,
  "context.delta.validate": ({ snapshot, delta }) => validateContextDelta(snapshot, delta),
  "mcp.task-project": ({ snapshot, options }) => projectMcpTask(snapshot, options),
  "effect.stale-fence-probe": staleFenceProbe,
  "task.transition.validate": ({ from, to }) => validateTransition(from, to)
});
