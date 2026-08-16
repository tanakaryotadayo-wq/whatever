import { canonicalJson } from "@akashic/contracts";

function atPath(value, path = "") {
  if (!path) return value;
  return String(path).split(".").filter(Boolean).reduce((current, segment) => current?.[segment], value);
}

function subset(expected, actual) {
  if (expected === null || typeof expected !== "object") return Object.is(expected, actual);
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((value, index) => subset(value, actual[index]));
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  return Object.entries(expected).every(([key, value]) => subset(value, actual[key]));
}

function orderedValues(values, actual) {
  if (!Array.isArray(actual)) return false;
  let cursor = 0;
  for (const value of actual) {
    if (cursor < values.length && canonicalJson(value) === canonicalJson(values[cursor])) cursor += 1;
  }
  return cursor === values.length;
}

export function gradeEvaluation({ expected, actual, error }) {
  let passed = false;
  let observed;
  if (expected.kind === "error_code") {
    observed = error?.code ?? error?.name ?? null;
    passed = observed === expected.code;
  } else if (error) {
    observed = { error: { name: error.name, code: error.code ?? null, message: error.message } };
  } else if (expected.kind === "exact") {
    observed = atPath(actual, expected.path);
    passed = canonicalJson(observed) === canonicalJson(expected.value);
  } else if (expected.kind === "subset") {
    observed = atPath(actual, expected.path);
    passed = subset(expected.value, observed);
  } else if (expected.kind === "ordered_values") {
    observed = atPath(actual, expected.path);
    passed = orderedValues(expected.values, observed);
  } else {
    throw new TypeError(`unsupported grader: ${expected.kind}`);
  }
  return { passed, grader: expected.kind, observed };
}
