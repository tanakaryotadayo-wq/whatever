import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  acceptEvalCandidate,
  makeEvalCandidate,
  parseEvalJsonl,
  runEvalDataset,
  serializeEvalJsonl
} from "../src/index.js";

const artifact = (ch, label) => ({ media_type: "application/json", digest: `sha256:${ch.repeat(64)}`, size: 1, uri: `fixture://${label}` });

test("accepted Akashic JSONL regression corpus passes deterministic graders", async () => {
  const text = await readFile(fileURLToPath(new URL("../evals/akashic-core.jsonl", import.meta.url)), "utf8");
  const cases = parseEvalJsonl(text, { source: "akashic-core.jsonl" });
  const report = await runEvalDataset(cases);
  assert.equal(report.total, 10);
  assert.equal(report.accepted, 10);
  assert.equal(report.failed, 0, JSON.stringify(report.results.filter((result) => !result.passed), null, 2));
  assert.match(report.dataset_digest, /^sha256:/);
  assert.match(report.report_digest, /^sha256:/);
});

test("JSONL serialization is deterministic and rejects duplicate IDs", () => {
  const candidate = makeEvalCandidate({ case_id: "candidate-one", capability: "routing.decide", input: { input: { task_id: "t" } }, expected: { kind: "subset", value: { lane: "fast" } }, source_refs: [artifact("a", "trace")], tags: ["z", "a"] });
  const encoded = serializeEvalJsonl([candidate]);
  const [decoded] = parseEvalJsonl(encoded);
  assert.equal(decoded.case_digest, candidate.case_digest);
  assert.deepEqual(decoded.tags, ["a", "z"]);
  assert.throws(() => parseEvalJsonl(encoded + encoded), /duplicate case_id/);
});

test("trace-derived cases remain candidates until verification is attached", async () => {
  const candidate = makeEvalCandidate({ case_id: "human-correction", capability: "policy.evaluate", input: { rules: [], request: { operation: "write", mutation: true } }, expected: { kind: "subset", value: { decision: "forbid" } }, source_refs: [artifact("b", "trace"), artifact("c", "correction")] });
  const skipped = await runEvalDataset([candidate]);
  assert.equal(skipped.accepted, 0);
  assert.equal(skipped.skipped, 1);
  const accepted = acceptEvalCandidate(candidate, { verification_ref: artifact("d", "verification"), accepted_by: "independent-reviewer" });
  const report = await runEvalDataset([accepted]);
  assert.equal(report.failed, 0);
  assert.equal(report.passed, 1);
});

test("candidate cases require immutable source references", () => {
  assert.throws(() => makeEvalCandidate({ case_id: "bad-candidate", capability: "routing.decide", input: { input: { task_id: "t" } }, expected: { kind: "subset", value: { lane: "fast" } }, source_refs: [] }), /source_refs/);
});
