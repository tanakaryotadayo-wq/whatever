const SEVERITY = Object.freeze({ allow: 0, prompt: 1, forbid: 2 });
export const POLICY_EFFECTS = Object.freeze(Object.keys(SEVERITY));
function matchesList(list, value) { if (list === undefined) return true; if (!Array.isArray(list) || list.length === 0) return false; return list.includes("*") || list.includes(value); }
function matchesPrefix(prefixes, resource) { if (prefixes === undefined) return true; if (!Array.isArray(prefixes) || prefixes.length === 0) return false; return prefixes.some((prefix) => prefix === "*" || resource.startsWith(prefix)); }
export function validatePolicyRule(rule) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new TypeError("policy rule must be an object");
  if (typeof rule.id !== "string" || rule.id.length === 0) throw new TypeError("policy rule requires id");
  if (!(rule.effect in SEVERITY)) throw new TypeError(`invalid policy effect: ${rule.effect}`);
  if (rule.operations !== undefined && !Array.isArray(rule.operations)) throw new TypeError("operations must be an array");
  if (rule.resource_prefixes !== undefined && !Array.isArray(rule.resource_prefixes)) throw new TypeError("resource_prefixes must be an array");
  if (rule.actors !== undefined && !Array.isArray(rule.actors)) throw new TypeError("actors must be an array");
  return structuredClone(rule);
}
export function evaluatePolicy(rules, request, options = {}) {
  if (!Array.isArray(rules)) throw new TypeError("rules must be an array");
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("request must be an object");
  const operation = request.operation;
  const resource = request.resource ?? "";
  const actor = request.actor ?? "unknown";
  if (typeof operation !== "string" || operation.length === 0) throw new TypeError("request.operation is required");
  if (typeof resource !== "string") throw new TypeError("request.resource must be a string");
  const matching = rules.map(validatePolicyRule).filter((rule) => matchesList(rule.operations, operation) && matchesPrefix(rule.resource_prefixes, resource) && matchesList(rule.actors, actor));
  let decision;
  if (matching.length === 0) decision = request.mutation === true ? (options.default_mutation ?? "forbid") : (options.default_read ?? "allow");
  else decision = matching.reduce((current, rule) => SEVERITY[rule.effect] > SEVERITY[current] ? rule.effect : current, "allow");
  if (!(decision in SEVERITY)) throw new TypeError(`invalid default policy decision: ${decision}`);
  const matchedRuleIds = matching.filter((rule) => SEVERITY[rule.effect] === SEVERITY[decision]).map((rule) => rule.id).sort();
  return { schema: "akashic.policy-decision/v1", decision, operation, resource, actor, mutation: request.mutation === true, matched_rule_ids: matchedRuleIds, policy_version: options.version ?? "akashic.policy/v1", reason: matchedRuleIds.length > 0 ? `highest-severity matching rule: ${matchedRuleIds.join(",")}` : `default ${request.mutation === true ? "mutation" : "read"} policy` };
}
export function runPolicyTestVectors(rules, vectors, options = {}) {
  if (!Array.isArray(vectors)) throw new TypeError("vectors must be an array");
  return vectors.map((vector, index) => { const actual = evaluatePolicy(rules, vector.request, options); return { index, name: vector.name ?? `vector-${index}`, expected: vector.expect, actual: actual.decision, passed: actual.decision === vector.expect, decision: actual }; });
}
