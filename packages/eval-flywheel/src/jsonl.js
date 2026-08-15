import { canonicalJson } from "@akashic/contracts";
import { validateEvalCase } from "./cases.js";

export function parseEvalJsonl(text, { source = "inline" } = {}) {
  if (typeof text !== "string") throw new TypeError("JSONL input must be a string");
  const cases = [];
  const ids = new Set();
  for (const [offset, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    let parsed;
    try { parsed = JSON.parse(line); }
    catch (error) { throw new SyntaxError(`${source}:${offset + 1}: invalid JSON: ${error.message}`); }
    const item = validateEvalCase(parsed);
    if (ids.has(item.case_id)) throw new TypeError(`${source}:${offset + 1}: duplicate case_id ${item.case_id}`);
    ids.add(item.case_id);
    cases.push(item);
  }
  return cases;
}

export function serializeEvalJsonl(cases) {
  if (!Array.isArray(cases)) throw new TypeError("cases must be an array");
  const checked = cases.map(validateEvalCase);
  if (new Set(checked.map((item) => item.case_id)).size !== checked.length) throw new TypeError("duplicate eval case IDs");
  return checked.map((item) => canonicalJson(item)).join("\n") + (checked.length ? "\n" : "");
}
