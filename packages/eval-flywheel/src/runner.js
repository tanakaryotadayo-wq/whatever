import { canonicalJson, sha256 } from "@akashic/contracts";
import { validateEvalCase } from "./cases.js";
import { DEFAULT_CAPABILITIES } from "./capabilities.js";
import { gradeEvaluation } from "./graders.js";

export async function runEvalCase(value, { capabilities = DEFAULT_CAPABILITIES } = {}) {
  const evalCase = validateEvalCase(value);
  if (evalCase.status !== "ACCEPTED") {
    return { schema: "akashic.eval-result/v1", case_id: evalCase.case_id, status: "SKIPPED", passed: null, reason: `case status is ${evalCase.status}`, case_digest: evalCase.case_digest ?? null };
  }
  const capability = capabilities[evalCase.capability];
  if (typeof capability !== "function") throw new Error(`UNKNOWN_EVAL_CAPABILITY:${evalCase.capability}`);
  let actual;
  let error = null;
  try { actual = await capability(structuredClone(evalCase.input)); }
  catch (caught) { error = caught; }
  const grade = gradeEvaluation({ expected: evalCase.expected, actual, error });
  return {
    schema: "akashic.eval-result/v1",
    case_id: evalCase.case_id,
    capability: evalCase.capability,
    status: "COMPLETED",
    passed: grade.passed,
    grader: grade.grader,
    observed: grade.observed,
    error: error ? { name: error.name, code: error.code ?? null, message: error.message } : null,
    case_digest: evalCase.case_digest ?? null
  };
}

export async function runEvalDataset(cases, options = {}) {
  if (!Array.isArray(cases)) throw new TypeError("cases must be an array");
  const results = [];
  for (const item of cases) results.push(await runEvalCase(item, options));
  const accepted = results.filter((result) => result.status === "COMPLETED");
  const failed = accepted.filter((result) => result.passed !== true);
  const report = {
    schema: "akashic.eval-report/v1",
    dataset_digest: `sha256:${sha256(canonicalJson(cases))}`,
    total: results.length,
    accepted: accepted.length,
    skipped: results.length - accepted.length,
    passed: accepted.length - failed.length,
    failed: failed.length,
    results
  };
  report.report_digest = `sha256:${sha256(canonicalJson(report))}`;
  return report;
}
