import { readFile } from "node:fs/promises";

const scenarioUrl = new URL("./scenario.json", import.meta.url);

export async function loadScenario() {
  return JSON.parse(await readFile(scenarioUrl, "utf8"));
}

function hasDigestEvidence(ref) {
  return typeof ref?.uri === "string"
    && /^sha256:[a-f0-9]{64}$/.test(ref?.digest ?? "");
}

export async function scoreBackendResult(result, scenario) {
  scenario ??= await loadScenario();
  if (result?.schema !== "akashic.orchestrator-bakeoff-result/v1") throw new TypeError("invalid result schema");
  if (result.scenario_id !== scenario.scenario_id) throw new TypeError("scenario mismatch");
  const evidenceComplete = Array.isArray(result.evidence_refs)
    && result.evidence_refs.length > 0
    && result.evidence_refs.every(hasDigestEvidence);
  const disqualifiers = new Set(result.disqualifiers ?? []);
  if (!evidenceComplete) disqualifiers.add("evidence_missing_digest");

  let score = 0;
  const gateResults = [];
  for (const gate of scenario.gates) {
    const passed = result.gates?.[gate.id] === true;
    if (passed) score += gate.weight;
    gateResults.push({ ...gate, passed });
  }
  const mandatoryPassed = gateResults.filter((gate) => gate.mandatory).every((gate) => gate.passed);
  const disqualified = scenario.disqualifiers.some((code) => disqualifiers.has(code));
  const complexityBonus = Math.max(0, 10 - Number(result.operational_components ?? 10));
  const normalized = Math.min(100, score + complexityBonus);
  return {
    schema: "akashic.orchestrator-bakeoff-score/v1",
    backend: result.backend,
    scenario_id: result.scenario_id,
    score: normalized,
    qualified: mandatoryPassed && !disqualified && evidenceComplete,
    mandatory_passed: mandatoryPassed,
    evidence_complete: evidenceComplete,
    disqualifiers: [...disqualifiers].sort(),
    operational_components: result.operational_components,
    gate_results: gateResults,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const path = process.argv[2];
  if (!path) throw new Error("usage: node score.mjs result.json");
  const result = JSON.parse(await readFile(path, "utf8"));
  process.stdout.write(`${JSON.stringify(await scoreBackendResult(result), null, 2)}\n`);
}
