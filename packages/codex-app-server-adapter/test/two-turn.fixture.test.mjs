import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  prepareLiveProtocol,
  runSingleCertification,
} from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fake = path.join(here, "fixtures", "fake-codex.mjs");
const repoFixture = path.resolve(here, "../../../fixtures/codex-live-two-turn");

test("fake App Server closes the same-thread delta-only two-turn contract", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "akashic-two-turn-test-"));
  try {
    const protocol = await prepareLiveProtocol({
      command: [process.execPath, fake],
      generatedRoot: path.join(root, "generated"),
    });
    const result = await runSingleCertification({
      command: [process.execPath, fake],
      fixtureRoot: repoFixture,
      evidenceRoot: path.join(root, "evidence"),
      protocol,
      iteration: 1,
    });
    assert.equal(result.manifest.status, "PASS");
    assert.equal(result.manifest.thread_start_count, 1);
    assert.equal(result.manifest.turn_start_count, 2);
    assert.equal(result.manifest.turn_1_outcome, "INPUT_REQUIRED");
    assert.equal(result.manifest.turn_2_outcome, "COMPLETED");
    assert.equal(result.manifest.task_capsule_resent_on_turn_2, false);
    assert.equal(result.manifest.credential_leak_scan_passed, true);
    assert.equal(result.manifest.artifact_refs.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
